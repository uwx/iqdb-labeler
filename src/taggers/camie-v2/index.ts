// Copied wholesale from https://github.com/jtydhr88/eagle-ai-tagger/blob/master/index.html

import path from 'node:path';

import * as onnx from 'onnxruntime-node';
import metadata from './camie-tagger-v2-metadata.json' with { type: 'json' };

const {
    categories,
    tag_mapping: {
        idx_to_tag: idxToTag,
        tag_to_idx: tagToIdx,
        tag_to_category: tagToCategory,
    }
} = metadata.dataset_info;

import sharp from 'sharp';
import { Match,
Matcher } from '../matcher';

const IMAGE_SIZE = 512;
const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];

/**
 * Converts image data to float32 tensors in NCHW format, normalized to ImageNet.
 * @param data The raw RGB pixel data as a buffer.
 * @param width The width of the image.
 * @param height The height of the image.
 * @returns float32 tensors in [1, 3, 512, 512] shape.
 */
async function preprocessImageNet(data: Buffer, width: number, height: number) {
    const floatData = new Float32Array(width * height * 3);

    // 2. Normalize pixel values
    for (let i = data.byteOffset; i < (width * height) + data.byteOffset; i++) {
        const r = data[i * 3] / 255;
        const g = data[i * 3 + 1] / 255;
        const b = data[i * 3 + 2] / 255;

        floatData[i] = (r - mean[0]) / std[0]; // R
        floatData[i + width * height] = (g - mean[1]) / std[1]; // G
        floatData[i + 2 * width * height] = (b - mean[2]) / std[2]; // B
    }

    // 3. Create ONNX tensor in NCHW format
    return new onnx.Tensor("float32", floatData, [1, 3, height, width]);
}

/**
 * Resizes and pads image to 512x512 with a plain white background, then returns it as onnx tensors in RGB order normalized to ImageNet.
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
            background: { r: 255, g: 255, b: 255, alpha: 255 },
        })
        .removeAlpha()
        .toColorspace('rgb')
        .raw({ depth: 'float' })
        .toBuffer({ resolveWithObject: true });

    return await preprocessImageNet(data, info.width, info.height);
}

/**
 * Loads the onnx model and creates an inference session.
 * @param modelDir Path to directory containing model.onnx
 * @returns The session.
 */
async function modelLoad(modelDir = './models') {
    const onnxPath = path.join(modelDir, "model.onnx");

    return await onnx.InferenceSession.create(onnxPath);
}

const session = await modelLoad('.');
const inputName = session.inputNames[0];

async function analyze(buffer: ArrayBuffer | Buffer | string) {
    const imagePreprocessed = await preprocessImage(Buffer.isBuffer(buffer) ? buffer : typeof buffer === 'string' ? buffer : Buffer.from(buffer));

    const results = await session.run({ [inputName]: imagePreprocessed });
    const prob = results[session.outputNames[0]].data as Float32Array;

    const combinedTags: [tag: string, prob: number][] = [];
    const generalThreshold = 0.35;
    const characterThreshold = 0.85;

    const ratings = [0, 0, 0, 0];

    // tags 0-3 are rating (general, sensitive, questionable, explicit)
    for (let i = 0; i < prob.length; i++) {
        const p = prob[i];

        const tagName = idxToTag[String(i) as keyof typeof idxToTag];
        const category = tagToCategory[tagName as keyof typeof tagToCategory] as 'year' | 'rating' | 'meta' | 'character' | 'artist' | 'copyright' | 'general';

        if (tagName == 'rating_general')
            ratings[0] = p;
        if (tagName == 'rating_sensitive')
            ratings[1] = p;
        if (tagName == 'rating_questionable')
            ratings[2] = p;
        if (tagName == 'rating_explicit')
            ratings[3] = p;

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
    } else { // all ratings are equal, go for explicit as a fallback
        rating = ['e', ratings[3]];
    }

    return { tags: combinedTags, rating } as const;
}

export class CamieMatcher extends Matcher {
    async getMatchImpl(imageUrl: string) {
        const buffer = await fetch(imageUrl).then(e => e.blob());
        const analyzed = await analyze(await buffer.arrayBuffer());

        const tags: number[] = await this.getTagIdsByNameOrAlias(
            analyzed.tags.map(([tag, p]) => tag)
        );

        if (tags.length > 0) {
            return { similarity: Math.max(...analyzed.tags.map(([tag, p]) => p)), tags } satisfies Match;
        }
    }
}
