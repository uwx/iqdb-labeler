import { readFile, writeFile } from "node:fs/promises";
import { compareSimilarity, generateSignature, LuminosityLevel, normalizedDistance, SignatureSimilarity } from "../puzzle/index.js";
import { join } from "path";
import sharp from 'sharp';
import assert from "node:assert";
import test from "node:test";
import { TEST_CASES_ROOT } from "./utils.js";
// import { compareSimilarity, generateSignature } from "../phash/index.js";

async function testNihlus() {
    const expectedSignature: ArrayLike<LuminosityLevel> & Iterable<LuminosityLevel> = await readFile(`${TEST_CASES_ROOT}/original-mona.signature`)
        .then(e => new Int8Array(e));

    const actualSignature = await generateSignature(await readFile(`${TEST_CASES_ROOT}/original-mona.jpg`), { time: true });

    console.log([...expectedSignature].map(e => e.toString().padStart(3, ' ')).join(','));
    console.log(actualSignature.map(e => e.toString().padStart(3, ' ')).join(','));

    assert.equal(compareSimilarity(expectedSignature, actualSignature), SignatureSimilarity.Identical);
}

class SampleImages {
    /** Gets a set of slightly edited Mona Lisa images. */
    static async *SlightlyEditedImages() {
        yield await this.Lisa9();
        yield await this.ChromaticMona();
    }
    /** Gets a set of significantly edited Mona Lisa images. */
    static async *SignificantlyEditedImages() {
        yield this.BritneySpearsMona();
        yield this.GangstaMona();
    }
    /** Gets a set of recoloured Mona Lisa images. */
    static async *RecolouredImages() {
        yield await this.BlueMona();
        yield await this.CyanMona();
        yield await this.GreenMona();
        yield await this.PinkMona();
        yield await this.RedMona();
        yield await this.YellowMona();
    }
    /** Gets a set of stylized Mona Lisa image copies. */
    static async *StylizedCopies() {
        yield await this.HorrorMona();
        yield await this.MonaLizzle();
        yield await this.PointilistMona();
    }
    /** Gets a set of real-life Mona Lisa photographs, containing real people. */
    static async *Photos() {
        yield await this.PhotoMona();
    }
    /** Gets a set of images that do not depict the Mona Lisa. */
    static async *DifferentImages() {
        yield await this.SaintMatthew();
        yield await this.SickBacchus();
        yield await this.JudithBeheading();
    }
    /** Gets a set of small single-colour images. */
    static async *SmallImages() {
        yield await this.Uniform1();
        yield await this.Uniform2();
        yield await this.Uniform4();
        yield await this.Uniform8();
        yield await this.Uniform16();
    }

    /** Gets the canonical Mona Lisa image. */
    static MonaLisa() { return this.getImage("original-mona.jpg")(); }

    /** Gets an edited Mona Lisa image. */
    static GangstaMona() { return this.getImage("gangsta-mona.jpg")(); }

    /** Gets an edited Mona Lisa image. */
    static BritneySpearsMona() { return this.getImage("lisa-spears.jpg")(); }

    /** Gets an edited Mona Lisa image. */
    static Lisa9() { return this.getImage("lisa9.jpg")(); }

    /** Gets a stylized Mona Lisa image. */
    static HorrorMona() { return this.getImage("mona-horror.jpg")(); }

    /** Gets a stylized Mona Lisa image. */
    static MonaLizzle() { return this.getImage("mona-lizzle.jpg")(); }

    /** Gets a stylized Mona Lisa image. */
    static PointilistMona() { return this.getImage("pointilist-mona.jpg")(); }

    /** Gets an edited Mona Lisa image. */
    static ChromaticMona() { return this.getImage("truth-lisa-chromatic.jpg")(); }

    /** Gets a real-life photograph Mona Lisa image. */
    static PhotoMona() { return this.getImage("truth-lisa-photo.jpg")(); }

    /** Gets a recoloured Mona Lisa image. */
    static BlueMona() { return this.getImage("recoloured-mona-blue.jpg")(); }

    /** Gets a recoloured Mona Lisa image. */
    static CyanMona() { return this.getImage("recoloured-mona-cyan.jpg")(); }

    /** Gets a recoloured Mona Lisa image. */
    static GreenMona() { return this.getImage("recoloured-mona-green.jpg")(); }

    /** Gets a recoloured Mona Lisa image. */
    static PinkMona() { return this.getImage("recoloured-mona-pink.jpg")(); }

    /** Gets a recoloured Mona Lisa image. */
    static RedMona() { return this.getImage("recoloured-mona-red.jpg")(); }

    /** Gets a recoloured Mona Lisa image. */
    static YellowMona() { return this.getImage("recoloured-mona-yellow.jpg")(); }

    /** Gets an original Caravaggio painting. */
    static SaintMatthew() { return this.getImage("saint-matthew.jpg")(); }

    /** Gets an original Caravaggio painting. */
    static JudithBeheading() { return this.getImage("judith-beheading.jpg")(); }

    /** Gets an original Caravaggio painting. */
    static SickBacchus() { return this.getImage("sick-bacchus.jpg")(); }

    /** Gets a single-colour 1x1 image. */
    static Uniform1() { return this.getImage("1x1.png")(); }

    /** Gets a single-colour 2x2 image. */
    static Uniform2() { return this.getImage("2x2.png")(); }

    /** Gets a single-colour 4x4 image. */
    static Uniform4() { return this.getImage("4x4.png")(); }

    /** Gets a single-colour 8x8 image. */
    static Uniform8() { return this.getImage("8x8.png")(); }

    /** Gets a single-colour 16x16 image. */
    static Uniform16() { return this.getImage("16x16.png")(); }

    /** Gets a single-colour 8k image. */
    static Uniform8192() { return this.getImage("8192x8192.png")(); }

    static getImage(image: string) {
        let cached: Buffer;
        return async () => {
            console.log('loading', image);
            return cached ??= await readFile(join(`${TEST_CASES_ROOT}`, image));
        };
    }
}

const testCases = {
    async IdenticalImagesCompareAsIdentical() {
        const firstSignature = await generateSignature(await SampleImages.MonaLisa());
        const secondSignature = await generateSignature(await SampleImages.MonaLisa());

        const result = compareSimilarity(firstSignature, secondSignature);

        assert.equal(SignatureSimilarity.Identical, result);
    },

    async DownscaledImagesCompareAsIdenticalOrSame() {
        const firstSignature = await generateSignature(await SampleImages.MonaLisa());

        let img = sharp(await SampleImages.MonaLisa());
        const meta = await img.metadata();
        img = img.resize({
            width: Math.floor(meta.width! / 2),
            height: Math.floor(meta.height! / 2),
        });
        const secondSignature = await generateSignature(img);

        const result = compareSimilarity(firstSignature, secondSignature);

        assert.ok(result == SignatureSimilarity.Identical || result == SignatureSimilarity.Same);
    },

    async UpscaledImagesCompareAsIdenticalOrSame() {
        const firstSignature = await generateSignature(await SampleImages.MonaLisa());

        let img = sharp(await SampleImages.MonaLisa());
        const meta = await img.metadata();
        img = img.resize({
            width: meta.width! * 2,
            height: meta.height! * 2,
        });
        const secondSignature = await generateSignature(img);

        const result = compareSimilarity(firstSignature, secondSignature);

        assert.ok(result == SignatureSimilarity.Identical || result == SignatureSimilarity.Same);
    },

    async DistortedImagesCompareAsIdenticalOrSame() {
        const firstSignature = await generateSignature(await SampleImages.MonaLisa());

        let img = sharp(await SampleImages.MonaLisa());
        const meta = await img.metadata();
        img = img.resize({
            width: meta.width! * 2,
            height: meta.height
        });
        const secondSignature = await generateSignature(img);

        const result = compareSimilarity(firstSignature, secondSignature);

        assert.ok(result == SignatureSimilarity.Identical || result == SignatureSimilarity.Same);
    },

    async RecolouredImagesCompareAsSame() {
        for await (const image of SampleImages.RecolouredImages()) {
            const firstSignature = await generateSignature(await SampleImages.MonaLisa());
            const secondSignature = await generateSignature(image);

            const result = compareSimilarity(firstSignature, secondSignature);

            assert.equal(SignatureSimilarity.Same, result);
        }
    },

    async SlightlyEditedImagesCompareAsSimilar() {
        for await (const image of SampleImages.SlightlyEditedImages()) {
            const firstSignature = await generateSignature(await SampleImages.MonaLisa());
            const secondSignature = await generateSignature(image);

            const result = compareSimilarity(firstSignature, secondSignature);

            assert.equal(SignatureSimilarity.Similar, result);
        }
    },

    async SignificantlyEditedImagesCompareAsSimilar() {
        for await (const image of SampleImages.SignificantlyEditedImages()) {
            const firstSignature = await generateSignature(await SampleImages.MonaLisa());
            const secondSignature = await generateSignature(image);

            const result = compareSimilarity(firstSignature, secondSignature);

            assert.equal(SignatureSimilarity.Similar, result);
        }
    },

    async StylizedCopiesCompareAsDissimilar() {
        for await (const image of SampleImages.StylizedCopies()) {
            const firstSignature = await generateSignature(await SampleImages.MonaLisa());
            const secondSignature = await generateSignature(image);

            const result = compareSimilarity(firstSignature, secondSignature);

            assert.equal(SignatureSimilarity.Dissimilar, result);
        }
    },

    async ArrangedPhotoCopiesCompareAsDissimilar() {
        for await (const image of SampleImages.Photos()) {
            const firstSignature = await generateSignature(await SampleImages.MonaLisa());
            const secondSignature = await generateSignature(image);

            const result = compareSimilarity(firstSignature, secondSignature);

            assert.equal(SignatureSimilarity.Dissimilar, result);
        }
    },

    async DifferentImagesCompareAsDifferent() {
        for await (const image of SampleImages.DifferentImages()) {
            const firstSignature = await generateSignature(await SampleImages.MonaLisa());
            const secondSignature = await generateSignature(image);

            const result = compareSimilarity(firstSignature, secondSignature);

            assert.equal(SignatureSimilarity.Different, result);
        }
    }
}

// https://stackoverflow.com/a/56678483
function sRGBtoLin(colorChannel: number) {
    if (colorChannel <= 0.04045) {
        return colorChannel / 12.92;
    } else {
        return Math.pow(((colorChannel + 0.055) / 1.055), 2.4);
    }
}

function YtoLstar(Y: number) {
    // Send this function a luminance value between 0.0 and 1.0,
    // and it returns L* which is "perceptual lightness"

    if ( Y <= (216/24389)) {       // The CIE standard states 0.008856 but 216/24389 is the intent for 0.008856451679036
        return Y * (24389/27);  // The CIE standard states 903.3, but 24389/27 is the intent, making 903.296296296296296
    } else {
        return Math.pow(Y,(1/3)) * 116 - 16;
    }
}

const lumaFunctions = {
    stackoverflow1(r: number, g: number, b: number) {
        return ((r * 0.2126) + (g * 0.7152) + (b * 0.0722) + 0.5);
    },

    stackoverflow2(r: number, g: number, b: number) {
        return (0.2126 * r + 0.7152 * g + 0.0722 * b);
    },

    gdimage(r: number, g: number, b: number) {
        return Math.floor((r * 77 + g * 151 + b * 28 + 128) / 256);
    },

    libpuzzle(r: number, g: number, b: number) {
        return (((r * 77) + (g * 151) + (b * 28) + 128) / 256); // from libpuzzle
    },
    skimage(r: number, g: number, b: number) {
        return (0.2125 * r) + (0.7154 * g) + (0.0721 * b); // from skimage
    },

    iforgor(r: number, g: number, b: number) {
        return .299 * r + .587 * g + .114 * b; // i forgor
    },

    zxing(r: number, g: number, b: number) {
        // https://github.com/micjahn/ZXing.Net/blob/master/Source/Bindings/ZXing.ImageSharp/ImageSharpLuminanceSource.cs
        let luminance = (b * 7424 + g * 38550 + r * 19562) >> 16;
        const alpha = 255;
        luminance = Math.floor(((luminance * alpha) >> 8) + (255 * (255 - alpha) >> 8) + 1);
        return luminance;
    },

    stackoverflow3(r: number, g: number, b: number) {
        // sRGB luminance(Y) values
        const rY = 0.212655;
        const gY = 0.715158;
        const bY = 0.072187;

        // Inverse of sRGB "gamma" function. (approx 2.2)
        function inv_gam_sRGB(ic: number) {
            const c = ic/255.0;
            if ( c <= 0.04045 )
                return c/12.92;
            else
                return Math.pow(((c+0.055)/(1.055)),2.4);
        }

        // sRGB "gamma" function (approx 2.2)
        function gam_sRGB(v: number) {
            if(v<=0.0031308)
                v *= 12.92;
            else
                v = 1.055*Math.pow(v,1.0/2.4)-0.055;
            return Math.floor(v*255+0.5); // This is correct in C++. Other languages may not require +0.5
        }

        // GRAY VALUE ("brightness")
        function gray(r: number, g: number, b: number) {
            return gam_sRGB(
                    rY*inv_gam_sRGB(r) +
                    gY*inv_gam_sRGB(g) +
                    bY*inv_gam_sRGB(b)
            );
        }

        return gray(r, g, b);
    }
}

await ((async () => {
    const expectedSignature: ArrayLike<LuminosityLevel> & Iterable<LuminosityLevel> = await readFile(`${TEST_CASES_ROOT}/original-mona.signature`)
        .then(e => new Int8Array(e));

    console.log([...expectedSignature].map(e => e.toString().padStart(3, ' ')).join(','));

    const monaJpg = sharp(await readFile(`${TEST_CASES_ROOT}/original-mona.jpg`));

    const buf = await monaJpg.clone().raw().toBuffer({ resolveWithObject: true });

    function getPixelLuma(image: { data: Buffer; info: sharp.OutputInfo; }, pixelArray: Uint8ClampedArray, x: number, y: number) {
        const stride = image.info.channels;
        const start = (x + (y * image.info.width)) * stride;

        function getLuma(r: number, g: number, b: number) {
            return Math.floor((r * .2126) + (g * .7152) + (b * .0722) + 0.5);
        }

        return stride == 1 ? pixelArray[start] : getLuma(pixelArray[start], pixelArray[start + 1], pixelArray[start + 2]);
    }

    const arr = new Uint8ClampedArray(buf.data);
    const outArr = new Uint8ClampedArray(buf.data.byteLength / buf.info.channels);

    for (let y = 0; y < buf.info.height; y++)
    for (let x = 0; x < buf.info.width; x++) {
        outArr[x + (y * buf.info.width)] = getPixelLuma(buf, arr, x, y);
    }

    // await writeFile(`${TEST_CASES_ROOT}/original-mona2.raw`, outArr);

    const distances = new Array<[funName: string, normalizedDistance: number]>();

    for (const doGamma of [true, false])
    for (const divideBy255 of [true, false])
    for (const multiplyBy255 of [true, false])
    for (const useYtoLstar of [true, false])
    for (const use_sRGBtoLin of [true, false]) {
        for (const [funName, fun] of Object.entries(lumaFunctions)) {
            const getLumaImpl = (r: number, g: number, b: number) => {
                // console.log(r, g, b);
                if (use_sRGBtoLin) {
                    r /= 255;
                    g /= 255;
                    b /= 255;
                    r = sRGBtoLin(r);
                    g = sRGBtoLin(g);
                    b = sRGBtoLin(b);
                    r *= 255;
                    g *= 255;
                    b *= 255;
                }
                if (divideBy255) {
                    r /= 255;
                    g /= 255;
                    b /= 255;
                }
                let luma = fun(r, g, b);
                if (useYtoLstar) {
                    luma = YtoLstar(luma);
                }
                if (multiplyBy255) {
                    luma *= 255;
                }
                return luma;
            };

            await test(`${funName}, div/255=${divideBy255}, mul*255=${multiplyBy255}, sRGBtoLin=${use_sRGBtoLin}, gamma=${doGamma}, lstar=${useYtoLstar}`, async () => {
                const actualSignature = await generateSignature(monaJpg.clone(), { time: true, debug_getLuma: getLumaImpl, debug_doGamma: doGamma });

                console.log(actualSignature.map(e => e.toString().padStart(3, ' ')).join(','));

                distances.push(
                    [`${funName}, div/255=${divideBy255}, mul*255=${multiplyBy255}, sRGBtoLin=${use_sRGBtoLin}, gamma=${doGamma}, lstar=${useYtoLstar}`, normalizedDistance(expectedSignature, actualSignature)]
                );

                assert.equal(normalizedDistance(expectedSignature, actualSignature), 0);
                assert.deepStrictEqual([...expectedSignature], actualSignature);
            });
        }
    }

    await test('nihlus', async () => {
        const actualSignature = await generateSignature(monaJpg.clone(), { time: true });

        console.log(actualSignature.map(e => e.toString().padStart(3, ' ')).join(','));

        compareSimilarity(expectedSignature, actualSignature);
        assert.deepStrictEqual([...expectedSignature], actualSignature);
    })
    await test('nihlus_gray', async () => {
        const actualSignature = await generateSignature(monaJpg.clone(), { time: true, debug_makeGrayscale: true });

        console.log(actualSignature.map(e => e.toString().padStart(3, ' ')).join(','));

        compareSimilarity(expectedSignature, actualSignature);
        assert.deepStrictEqual([...expectedSignature], actualSignature);
    })

    console.log(distances.toSorted((a, b) => a[1] - b[1]))
})());


// for (const [k, v] of Object.entries(testCases)) {
//     test(k, v);
// }