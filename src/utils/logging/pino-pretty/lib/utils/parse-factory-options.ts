import { LEVEL_NAMES } from '../constants';
import colors from '../colors';
import handleCustomLevelsOpts from './handle-custom-levels-opts';
import handleCustomLevelsNamesOpts from './handle-custom-levels-names-opts';
import handleLevelLabelData from './get-level-label-data';

import type { ColorizerFunc } from '../colors'; // Assuming ColorizerFunc is in colors.ts
import type { CustomPrettifiers, MessageFormatString, MessageFormatFunction } from './index'; // Or wherever these types are defined
import type { PinoPrettyOptions } from '../..';
import type { Colorette } from 'colorette';

/**
 * A `PrettyContext` is an object to be used by the various functions that
 * process log data. It is derived from the provided {@link PinoPrettyOptions}.
 * It may be used as a `this` context.
 */
export interface PrettyContext {
    /** The escape sequence chosen as the line terminator. */
    EOL: string;
    /** The string to use as the indentation sequence. */
    IDENT: string;
    /** A configured colorizer function. */
    colorizer: ColorizerFunc;
    /**
     * A set of custom color names associated with level numbers.
     * Each inner array is a pair of [levelNumber, colorName].
     */
    customColors?: Array<[number | string, string]>;
    /** A hash of level numbers to level names, e.g. `{ 30: "info" }`. */
    customLevelNames: Record<string | number, string | number>; // string | number because handleCustomLevelsNamesOpts can return numbers
    /** A hash of level names to level numbers, e.g. `{ info: 30 }`. */
    customLevels: Record<string | number, string | number>; // string | number because handleCustomLevelsOpts can return numbers
    /** A hash of custom prettifier functions. */
    customPrettifiers: Record<string, (value: any, key: string, log: object, context: { colors: Colorette }) => string>; 
    /** Comprised of `customLevels` and `customLevelNames` if such options are provided. */
    customProperties: {
        customLevels?: Record<string | number, string | number>;
        customLevelNames?: Record<string | number, string | number>;
    };
    /** The key names in the log data that should be considered as holding error objects. */
    errorLikeObjectKeys: string[];
    /** A list of error object keys that should be included in the output. */
    errorProps: string[];
    /** Pass a numeric level to return [levelLabelString, levelNum] */
    getLevelLabelData: (level: string | number) => [string, string | number];
    /** Indicates the prettifier should omit objects in the output. */
    hideObject: boolean;
    /** Set of log data keys to omit. */
    ignoreKeys?: Set<string>;
    /** Opposite of `ignoreKeys`. If defined, `ignoreKeys` will be undefined. */
    includeKeys?: Set<string>;
    /** Indicates the level should be printed first. */
    levelFirst: boolean;
    /** Name of the key in the log data that contains the level. */
    levelKey: string;
    /** Format token to represent the position of the level name in the output string. */
    levelLabel: string;
    /** Defines how the logged message should be formatted. */
    messageFormat?: MessageFormatString | MessageFormatFunction;
    /** Name of the key in the log data that contains the message. */
    messageKey: string;
    /** The minimum log level to process and output. */
    minimumLevel?: string | number;
    /** A configured colorizer function for objects. */
    objectColorizer: ColorizerFunc;
    /** Indicates objects should be printed on a single output line. */
    singleLine: boolean;
    /** The name of the key in the log data that contains the log timestamp. */
    timestampKey: string;
    /** Indicates if timestamps should be translated to a human-readable string or a specific format. */
    translateTime: boolean | string;
    /** Indicates whether to use only custom levels and level names if provided. */
    useOnlyCustomProps: boolean;
}

/**
 * @param {PinoPrettyOptions} options The user supplied object of options.
 *
 * @returns {PrettyContext}
 */
export default function parseFactoryOptions(options: PinoPrettyOptions): PrettyContext {
    const EOL = options.crlf ? '\r\n' : '\n';
    const IDENT = '    ';
    const {
        customPrettifiers,
        errorLikeObjectKeys,
        hideObject,
        levelFirst,
        levelKey,
        levelLabel,
        messageFormat,
        messageKey,
        minimumLevel,
        singleLine,
        timestampKey,
        translateTime,
    } = options;
    const errorProps = options.errorProps!.split(',');
    const useOnlyCustomProps =
        typeof options.useOnlyCustomProps === 'boolean'
            ? options.useOnlyCustomProps
            : options.useOnlyCustomProps === 'true';
    const customLevels = handleCustomLevelsOpts(options.customLevels!);
    const customLevelNames = handleCustomLevelsNamesOpts(options.customLevels!);
    const getLevelLabelData = handleLevelLabelData(useOnlyCustomProps, customLevels, customLevelNames);

    let customColors;
    if (options.customColors) {
        if (typeof options.customColors === 'string') {
            customColors = options.customColors.split(',').reduce((agg, value) => {
                const [level, color] = value.split(':');
                const condition = useOnlyCustomProps ? options.customLevels : customLevelNames[level] !== undefined;
                const levelNum = condition ? customLevelNames[level] : LEVEL_NAMES[level];
                const colorIdx = levelNum !== undefined ? levelNum : level;
                agg.push([colorIdx, color]);
                return agg;
            }, []);
        } else if (typeof options.customColors === 'object') {
            customColors = Object.keys(options.customColors).reduce((agg, value) => {
                const [level, color] = [value, options.customColors[value]];
                const condition = useOnlyCustomProps ? options.customLevels : customLevelNames[level] !== undefined;
                const levelNum = condition ? customLevelNames[level] : LEVEL_NAMES[level];
                const colorIdx = levelNum !== undefined ? levelNum : level;
                agg.push([colorIdx, color]);
                return agg;
            }, []);
        } else {
            throw new Error('options.customColors must be of type string or object.');
        }
    }

    const customProperties = { customLevels, customLevelNames };
    if (useOnlyCustomProps === true && !options.customLevels) {
        customProperties.customLevels = undefined!;
        customProperties.customLevelNames = undefined!;
    }

    const includeKeys = options.include !== undefined ? new Set(options.include.split(',')) : undefined;
    const ignoreKeys = !includeKeys && options.ignore ? new Set(options.ignore.split(',')) : undefined;

    const colorizer = colors(options.colorize, customColors, useOnlyCustomProps);
    const objectColorizer = options.colorizeObjects ? colorizer : colors(false, [], false);

    return {
        EOL,
        IDENT,
        colorizer,
        customColors,
        customLevelNames,
        customLevels,
        customPrettifiers,
        customProperties,
        errorLikeObjectKeys,
        errorProps,
        getLevelLabelData,
        hideObject,
        ignoreKeys,
        includeKeys,
        levelFirst,
        levelKey,
        levelLabel,
        messageFormat,
        messageKey,
        minimumLevel,
        objectColorizer,
        singleLine,
        timestampKey,
        translateTime,
        useOnlyCustomProps,
    };
}
