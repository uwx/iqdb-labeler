const nocolor = (input: string) => input;
const plain = {
    default: nocolor,
    60: nocolor,
    50: nocolor,
    40: nocolor,
    30: nocolor,
    20: nocolor,
    10: nocolor,
    message: nocolor,
    greyMessage: nocolor,
    property: nocolor,
};

import { createColors, type Colorette } from 'colorette';
import getLevelLabelData from './utils/get-level-label-data';
const availableColors = createColors({ useColor: true });
const { white, bgRed, red, yellow, green, blue, gray, cyan, magenta } = availableColors;

const colored = {
    default: white,
    60: bgRed,
    50: red,
    40: yellow,
    30: green,
    20: blue,
    10: gray,
    message: cyan,
    greyMessage: gray,
    property: magenta,
};

function resolveCustomColoredColorizer(customColors: Array<[level: string | number, color: string]>) {
    return customColors.reduce(
        (agg, [level, color]) => {
            agg[level] = typeof availableColors[color] === 'function' ? availableColors[color] : white;

            return agg;
        },
        { default: white, message: cyan, greyMessage: gray },
    );
}

function colorizeLevel(useOnlyCustomProps: boolean) {
    return (level: string | number, colorizer: typeof plain, { customLevels, customLevelNames }: { customLevels?: object, customLevelNames?: object } = {}) => {
        const [levelStr, levelNum] = getLevelLabelData(useOnlyCustomProps, customLevels, customLevelNames)(level);

        return Object.prototype.hasOwnProperty.call(colorizer, levelNum)
            ? colorizer[levelNum](levelStr)
            : colorizer.default(levelStr);
    };
}

function plainColorizer(useOnlyCustomProps: boolean) {
    const newPlainColorizer = colorizeLevel(useOnlyCustomProps);
    const customColoredColorizer = ((level: string | number, opts?: { customLevels?: object, customLevelNames?: object }) => newPlainColorizer(level, plain, opts)) as ColorizerFunc;
    customColoredColorizer.message = plain.message;
    customColoredColorizer.greyMessage = plain.greyMessage;
    customColoredColorizer.property = plain.property;
    customColoredColorizer.colors = createColors({ useColor: false });
    return customColoredColorizer;
}

function coloredColorizer(useOnlyCustomProps: boolean) {
    const newColoredColorizer = colorizeLevel(useOnlyCustomProps);
    const customColoredColorizer = ((level: string | number, opts?: { customLevels?: object, customLevelNames?: object }) => newColoredColorizer(level, colored, opts)) as ColorizerFunc;
    customColoredColorizer.message = colored.message;
    customColoredColorizer.property = colored.property;
    customColoredColorizer.greyMessage = colored.greyMessage;
    customColoredColorizer.colors = availableColors;
    return customColoredColorizer;
}

function customColoredColorizerFactory(customColors: Array<[level: string | number, color: string]>, useOnlyCustomProps: boolean) {
    const onlyCustomColored = resolveCustomColoredColorizer(customColors);
    const customColored = useOnlyCustomProps ? onlyCustomColored : Object.assign({}, colored, onlyCustomColored);
    const colorizeLevelCustom = colorizeLevel(useOnlyCustomProps);

    const customColoredColorizer = ((level: string | number, opts?: { customLevels?: object, customLevelNames?: object }) => colorizeLevelCustom(level, customColored, opts)) as ColorizerFunc;
    customColoredColorizer.colors = availableColors;
    customColoredColorizer.message = customColoredColorizer.message || customColored.message;
    customColoredColorizer.greyMessage = customColoredColorizer.greyMessage || customColored.greyMessage;

    return customColoredColorizer;
}

/**
 * Applies colorization, if possible, to a string representing the passed in
 * `level`. For example, the default colorizer will return a "green" colored
 * string for the "info" level.
 */
export interface ColorizerFunc {
  /**
   * @param level In either case, the input will map to a color
   * for the specified level or to the color for `USERLVL` if the level is not
   * recognized.
   * @param opts Optional parameters, often including customLevels and customLevelNames
   */
  (level: string | number, opts?: { customLevels?: object, customLevelNames?: object }): string;
  /**
   * Accepts one string parameter that will be colorized to a predefined color.
   */
  message: (input: string) => string;
  /**
   * Accepts one string parameter that will be colorized to a predefined (grey) color.
   */
  greyMessage: (input: string) => string;
  /**
   * Accepts one string parameter that will be colorized to a predefined color for properties.
   */
  property: (input: string) => string;
  /**
   * Available color functions based on `useColor` (or `colorize`) context.
   */
  colors: Colorette;
}

/**
 * Factory function get a function to colorized levels. The returned function
 * also includes a `.message(str)` method to colorize strings.
 *
 * @param {boolean} [useColors=false] When `true` a function that applies standard
 * terminal colors is returned.
 * @param {array[]} [customColors] Tuple where first item of each array is the
 * level index and the second item is the color
 * @param {boolean} [useOnlyCustomProps] When `true`, only use the provided
 * custom colors provided and not fallback to default
 *
 * @returns {ColorizerFunc} `function (level) {}` has a `.message(str)` method to
 * apply colorization to a string. The core function accepts either an integer
 * `level` or a `string` level. The integer level will map to a known level
 * string or to `USERLVL` if not known.  The string `level` will map to the same
 * colors as the integer `level` and will also default to `USERLVL` if the given
 * string is not a recognized level name.
 */
export default function getColorizer(useColors: boolean | undefined, customColors: Array<[level: string | number, color: string]>, useOnlyCustomProps: boolean): ColorizerFunc { 
    if (useColors && customColors !== undefined) {
        return customColoredColorizerFactory(customColors, useOnlyCustomProps);
    }
    if (useColors) {
        return coloredColorizer(useOnlyCustomProps);
    }

    return plainColorizer(useOnlyCustomProps);
}
