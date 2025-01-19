// Copied wholesale from https://github.com/jtydhr88/eagle-ai-tagger/blob/master/index.html

import path from 'node:path';

import * as ort from 'onnxruntime-node';
import cv from '@techstark/opencv-js';

import { Canvas, createCanvas, Image, ImageData, loadImage } from 'canvas';
import { JSDOM } from 'jsdom';
import { createReadStream } from 'node:fs';
import csv from 'csv-parser';
import sharp from 'sharp';

const IMAGE_SIZE = 448;

async function preprocessImage(imagePath: string | Buffer) {
    const img = sharp(imagePath);

    const metadata = await img.metadata();
    
    const size = Math.max(metadata.width!, metadata.height!); 
    const padTop = Math.floor((size - metadata.height!) / 2);
    const padBottom = size - metadata.height! - padTop;
    const padLeft = Math.floor((size - metadata.width!) / 2);
    const padRight = size - metadata.width! - padLeft;

    console.log(metadata, {
        padTop,
        padBottom,
        padLeft,
        padRight,
    });

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
    
    // convert to BGR
    // imageData = new Float32Array(IMAGE_SIZE * IMAGE_SIZE * 3);
    // for (let y = 0; y < IMAGE_SIZE; y++) {
    //     for (let x = 0; x < IMAGE_SIZE; x++) {
    //         const pixel = img.ucharPtr(y, x);
    //         imageData[((y * IMAGE_SIZE + x) * 3 + 0)] = pixel[2]; // Red
    //         imageData[((y * IMAGE_SIZE + x) * 3 + 1)] = pixel[1]; // Green
    //         imageData[((y * IMAGE_SIZE + x) * 3 + 2)] = pixel[0]; // Blue
    //     }
    // }

    return new ort.Tensor('float32', imageData, [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
}

async function modelLoad(modelDir = './models') {
    const onnxPath = path.join(modelDir, "model.onnx");

    const session = await ort.InferenceSession.create(onnxPath);

    const inputName = session.inputNames[0];

    return [session, inputName] as [any, string];
}

async function parseCsv(filePath: string) {
    return new Promise<any[]>((resolve, reject) => {
        const results: any[] = [];
        createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

const rows = await parseCsv(path.join(import.meta.dirname, 'selected_tags.csv'));

const generalTags: string[] = rows.filter(row => row.category === "0").map(row => row.name);
const characterTags: string[] = rows.filter(row => row.category === "4").map(row => row.name);

const buffer = await fetch('https://cdn.donmai.us/sample/82/a6/__nilou_genshin_impact_drawn_by_kippeijii__sample-82a6e25f544a0c58420381a5e75002ca.jpg')
    .then(e => e.arrayBuffer());

console.time('start');
const model = await modelLoad(import.meta.dirname);

const [session, inputName] = model;

const imagePreprocessed = await preprocessImage(Buffer.from(buffer));

const results = await session.run({[inputName]: imagePreprocessed});
const prob = results[session.outputNames[0]].data;
console.timeEnd('start');

const combinedTags: [tag: string, prob: number][] = [];
const generalThreshold = 0.35;
const characterThreshold = 0.6;

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


console.log(combinedTags);

