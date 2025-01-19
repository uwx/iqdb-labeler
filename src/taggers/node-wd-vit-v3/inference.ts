// Copied wholesale from https://github.com/jtydhr88/eagle-ai-tagger/blob/master/index.html

import path from 'node:path';

import * as onnx from 'onnxruntime-node';

import { createReadStream } from 'node:fs';
import csv from 'csv-parser';
import sharp from 'sharp';

const IMAGE_SIZE = 448;

/**
 * Resizes and pads image to 448x448 with a plain white background, then returns it as onnx tensors in BGR order.
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
        .toColorspace('bgr')
        .raw({ depth: 'float'})
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
    const onnxPath = path.join(modelDir, "model.onnx");

    return await onnx.InferenceSession.create(onnxPath);
}

/**
 * Parses selected_tags.csv into an array of objects.
 * @param filePath Path to selected_tags.csv
 * @returns The tags in model output order.
 */
async function parseCsv(filePath: string) {
    return new Promise<{
        tag_id: string,
        name: string,
        category: string,
        count: string,
    }[]>((resolve, reject) => {
        const results: {
            tag_id: string,
            name: string,
            category: string,
            count: string,
        }[] = [];

        createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

const rows = await parseCsv(path.join(import.meta.dirname, 'selected_tags.csv'));

const generalTags = rows.filter(row => row.category === "0").map(row => row.name);
const characterTags = rows.filter(row => row.category === "4").map(row => row.name);

const session = await modelLoad(import.meta.dirname);
const inputName = session.inputNames[0];

export async function analyze(buffer: ArrayBuffer) {
    const imagePreprocessed = await preprocessImage(Buffer.from(buffer));

    const results = await session.run({[inputName]: imagePreprocessed});
    const prob = results[session.outputNames[0]].data as Float32Array;

    const combinedTags: [tag: string, prob: number][] = [];
    const generalThreshold = 0.35;
    const characterThreshold = 0.85;

    // tags 0-3 are rating (general, sensitive, questionable, explicit)
    for (let i = 4; i < prob.length; i++) {
        const p = prob[i];

        let tagName: string;

        if (i - 4 < generalTags.length && p >= generalThreshold) {
            tagName = generalTags[i - 4];
        } else if (i - 4 >= generalTags.length && p >= characterThreshold) {
            tagName = characterTags[i - 4 - generalTags.length];
        } else {
            continue;
        }

        combinedTags.push([tagName, p]);
    }

    return combinedTags;
}
