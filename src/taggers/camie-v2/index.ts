// Copied wholesale from https://github.com/jtydhr88/eagle-ai-tagger/blob/master/index.html

import path from 'node:path';

import * as onnx from 'onnxruntime-node';
import metadata from './camie-tagger-v2-metadata.json' with { type: 'json' };

const {
    categories,
    tag_mapping: { idx_to_tag: idxToTag, tag_to_idx: tagToIdx, tag_to_category: tagToCategory },
} = metadata.dataset_info;

import sharp from 'sharp';
import { Match, Matcher } from '../matcher';
import logger from '../../backend/logger';

const IMAGE_SIZE = 512;
const mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];

/**
 * Converts image data to float32 tensors in NCHW format, normalized to ImageNet.
 * @param data The raw RGB pixel data as a buffer.
 * @param width The width of the image.
 * @param height The height of the image.
 * @returns float32 tensors in [1, 3, 512, 512] shape.
 */
async function preprocessImageNet(data: Buffer, width: number, height: number) {
    const floatData = new Float32Array(width * height * 3);
    const pixelCount = width * height;

    // data from sharp with depth:'float' is already 0.0-1.0 floats
    const srcView = new Float32Array(data.buffer, data.byteOffset, pixelCount * 3);

    for (let i = 0; i < pixelCount; i++) {
        const r = srcView[i * 3];
        const g = srcView[i * 3 + 1];
        const b = srcView[i * 3 + 2];

        floatData[i] = (r - mean[0]) / std[0]; // R channel
        floatData[i + pixelCount] = (g - mean[1]) / std[1]; // G channel
        floatData[i + 2 * pixelCount] = (b - mean[2]) / std[2]; // B channel
    }

    return new onnx.Tensor('float32', floatData, [1, 3, height, width]);
}

/**
 * Resizes and pads image to 512x512 with a plain background, then returns it as onnx tensors in RGB order normalized to ImageNet.
 * @param imagePath Path to image or buffer containing image data.
 * @returns float32 tensors in [3, 512, 512] shape.
 */
async function preprocessImage(imagePath: string | Buffer) {
    const img = sharp(imagePath);

    const { data, info } = await img
        .resize({
            width: IMAGE_SIZE,
            height: IMAGE_SIZE,
            kernel: 'cubic',
            fit: 'contain',
            // Using RGB values close to ImageNet mean: (0.485*255, 0.456*255, 0.406*255)
            background: { r: 124, g: 116, b: 104, alpha: 255 },
        })
        .removeAlpha()
        .withIccProfile('srgb', { attach: true })
        .toColorspace('srgb')
        .raw({ depth: 'float' })
        .toBuffer({ resolveWithObject: true });

    return await preprocessImageNet(data, info.width, info.height);
}

/**
 * Loads the onnx model and creates an inference session.
 * @param modelDir Path to directory containing camie-tagger-v2.onnx
 * @returns The session.
 */
async function modelLoad(modelDir = './models') {
    const onnxPath = path.join(modelDir, 'camie-tagger-v2.onnx');

    return await onnx.InferenceSession.create(onnxPath, {
        executionMode: 'parallel',
        graphOptimizationLevel: 'all',
        executionProviders: [
            {
                name: 'dml',
            },
            {
                name: 'cuda',
            },
            {
                name: 'cpu',
                useArena: true,
            },
        ],
    });
}

const session = await modelLoad('./models');
const inputName = session.inputNames[0];

async function analyze(buffer: ArrayBuffer | Buffer | string) {
    const startTime = Date.now();

    const imagePreprocessed = await preprocessImage(
        Buffer.isBuffer(buffer) ? buffer : typeof buffer === 'string' ? buffer : Buffer.from(buffer),
    );

    const results = await session.run({ [inputName]: imagePreprocessed });

    const endTime = Date.now();
    logger.debug(`Inference time: ${endTime - startTime} ms`);

    // Use refined predictions (output index 1), not initial predictions (index 0)
    const logits = results[session.outputNames[1]].data as Float32Array;

    // Apply sigmoid to convert logits to probabilities
    const prob = logits.map((x) => 1.0 / (1.0 + Math.exp(-x)));

    const combinedTags: [tag: string, prob: number][] = [];
    const generalThreshold = 0.35;
    const characterThreshold = 0.85;

    const ratings = [0, 0, 0, 0];

    // tags 0-3 are rating (general, sensitive, questionable, explicit)
    for (let i = 0; i < prob.length; i++) {
        const p = prob[i];

        const tagName = idxToTag[String(i) as keyof typeof idxToTag];
        const category = tagToCategory[tagName as keyof typeof tagToCategory] as
            | 'year'
            | 'rating'
            | 'meta'
            | 'character'
            | 'artist'
            | 'copyright'
            | 'general';

        if (tagName == 'rating_general') ratings[0] = p;
        if (tagName == 'rating_sensitive') ratings[1] = p;
        if (tagName == 'rating_questionable') ratings[2] = p;
        if (tagName == 'rating_explicit') ratings[3] = p;

        // logger.debug(`Tag: ${tagName}, Category: ${category}, Probability: ${p.toFixed(4)}`);

        if (category == 'general' && p >= generalThreshold) {
            // empty
        } else if (category == 'character' && p >= characterThreshold) {
            // empty
        } else {
            continue;
        }

        combinedTags.push([tagName, p]);
    }

    let rating: [rating: 'g' | 's' | 'q' | 'e', prob: number];

    if (ratings[0] >= ratings[1] && ratings[0] >= ratings[2] && ratings[0] >= ratings[3]) {
        rating = ['g', ratings[0]];
    } else if (ratings[1] >= ratings[0] && ratings[1] >= ratings[2] && ratings[1] >= ratings[3]) {
        rating = ['s', ratings[1]];
    } else if (ratings[2] >= ratings[0] && ratings[2] >= ratings[1] && ratings[2] >= ratings[3]) {
        rating = ['q', ratings[2]];
    } else if (ratings[3] >= ratings[0] && ratings[3] >= ratings[1] && ratings[3] >= ratings[2]) {
        rating = ['e', ratings[3]];
    } else {
        // all ratings are equal, go for explicit as a fallback
        rating = ['e', ratings[3]];
    }

    return { tags: combinedTags, rating } as const;
}

export class CamieMatcher extends Matcher {
    async getMatchImpl(imageUrl: string) {
        const startTime = Date.now();
        const buffer = await fetch(imageUrl).then((e) => e.blob());
        const endTime = Date.now();

        logger.debug(`Image fetch time: ${endTime - startTime} ms`);

        const analyzed = await analyze(await buffer.arrayBuffer());

        const tags: bigint[] = await this.getTagIdsByNameOrAlias(analyzed.tags.map(([tag, p]) => tag));

        if (tags.length > 0) {
            return { similarity: Math.max(...analyzed.tags.map(([tag, p]) => p)), tags } satisfies Match;
        }
    }
}
