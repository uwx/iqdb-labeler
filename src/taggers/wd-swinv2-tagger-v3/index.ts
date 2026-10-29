// Copied wholesale from https://github.com/jtydhr88/eagle-ai-tagger/blob/master/index.html

import path from 'node:path';

import * as onnx from 'onnxruntime-node';
import selectedTags from './selected_tags.csv?raw';
import csv from 'csv-parser';
import sharp from 'sharp';
import { Match, Matcher } from '../matcher';
import logger from '../../backend/logger';
import { Readable } from 'node:stream';

const IMAGE_SIZE = 448;

/**
 * Resizes and pads image to 448x448 with a white background, then returns it as onnx tensors in RGB order normalized to ImageNet.
 * @param imagePath Path to image or buffer containing image data.
 * @returns float32 tensors in [1, 448, 448, 3] shape.
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
        .withIccProfile('srgb', { attach: true })
        .toColorspace('srgb')
        .raw({ depth: 'float' })
        .toBuffer({ resolveWithObject: true });

    const imageData = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    console.log(info);
    console.log(imageData.length);

    return new onnx.Tensor('float32', imageData, [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
}

/**
 * Loads the onnx model and creates an inference session.
 * @param modelDir Path to directory containing model.onnx
 * @returns The session.
 */
async function modelLoad(modelDir = './models') {
    const onnxPath = path.join(modelDir, 'model.onnx');

    return await onnx.InferenceSession.create(onnxPath, {
        executionMode: 'parallel',
        graphOptimizationLevel: 'all',
    });
}

/**
 * Parses selected_tags.csv into an array of objects.
 * @param data The CSV data as a string.
 * @returns The tags in model output order.
 */
async function parseCsv(data: string) {
    return new Promise<
        {
            tag_id: string;
            name: string;
            category: string;
            count: string;
        }[]
    >((resolve, reject) => {
        const results: {
            tag_id: string;
            name: string;
            category: string;
            count: string;
        }[] = [];

        Readable.from(data)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}
const rows = await parseCsv(selectedTags);

const generalTags = rows.filter((row) => row.category === '0').map((row) => row.name);
const characterTags = rows.filter((row) => row.category === '4').map((row) => row.name);

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

    const prob = results[session.outputNames[0]].data as Float32Array;

    const combinedTags: [tag: string, prob: number][] = [];
    const generalThreshold = 0.35;
    const characterThreshold = 0.85;

    const ratings = [0, 0, 0, 0];

    // tags 0-3 are rating (general, sensitive, questionable, explicit)
    for (let i = 0; i < prob.length; i++) {
        const p = prob[i];

        let tagName: string;

        if (i < 4) {
            ratings[i] = p;
            continue;
        }

        if (i - 4 < generalTags.length && p >= generalThreshold) {
            tagName = generalTags[i - 4];
        } else if (i - 4 >= generalTags.length && p >= characterThreshold) {
            tagName = characterTags[i - 4 - generalTags.length];
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

export class WdMatcher extends Matcher {
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
