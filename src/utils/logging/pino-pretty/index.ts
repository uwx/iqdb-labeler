import { isColorSupported, type Colorette } from 'colorette';
import pump from 'pump';
import { Transform } from 'node:stream';
import abstractTransport, { type OnUnknown } from 'pino-abstract-transport';
import colors from './lib/colors';
import { ERROR_LIKE_KEYS, LEVEL_KEY, LEVEL_LABEL, MESSAGE_KEY, TIMESTAMP_KEY } from './lib/constants';
import {
    buildSafeSonicBoom,
    parseFactoryOptions,
    type CustomPrettifiers,
    type MessageFormatFunction,
    type MessageFormatString,
} from './lib/utils';
import pretty, { type LogPrettifierFunc } from './lib/pretty';
import type SonicBoom from 'sonic-boom';
import type { DestinationStream, Level, LogDescriptor } from 'pino';
import type { colorizerFactory } from 'pino-pretty';

export namespace PinoPretty {
    export type PrettyOptions = PinoPrettyOptions;
}

export type Prettifier<T = object> = (
    inputData: string | object,
    key: string,
    log: object,
    extras: PrettifierExtras<T>,
) => string;
export type PrettifierExtras<T = object> = { colors: Colorette } & T;
export type LevelPrettifierExtras = { label: string; labelColorized: string };
export type MessageFormatFunc = (
    log: LogDescriptor,
    messageKey: string,
    levelLabel: string,
    extras: PrettifierExtras,
) => string;
export type PrettyStream = Transform & OnUnknown;
export type ColorizerFactory = typeof colorizerFactory;
export type PrettyFactory = typeof prettyFactory;
export type Build = typeof build;

export interface PinoPrettyOptions {
    /**
     * Hide objects from output (but not error object).
     * @default false
     */
    hideObject?: boolean;
    /**
     * Translate the epoch time value into a human readable date and time string. This flag also can set the format
     * string to apply when translating the date to human readable format. For a list of available pattern letters
     * see the {@link https://www.npmjs.com/package/dateformat|dateformat documentation}.
     * - The default format is `yyyy-mm-dd HH:MM:ss.l o` in UTC.
     * - Requires a `SYS:` prefix to translate time to the local system's timezone. Use the shortcut `SYS:standard`
     *   to translate time to `yyyy-mm-dd HH:MM:ss.l o` in system timezone.
     * @default false
     */
    translateTime?: boolean | string;
    /**
     * If set to true, it will print the name of the log level as the first field in the log line.
     * @default false
     */
    levelFirst?: boolean;
    /**
     * Define the key that contains the level of the log.
     * @default "level"
     */
    levelKey?: string;
    /**
     * Output the log level using the specified label.
     * @default "levelLabel"
     */
    levelLabel?: string;
    /**
     * The key in the JSON object to use as the highlighted message.
     * @default "msg"
     *
     * Not required when used with pino >= 8.21.0
     */
    messageKey?: string;
    /**
     * Print each log message on a single line (errors will still be multi-line).
     * @default false
     */
    singleLine?: boolean;
    /**
     * The key in the JSON object to use for timestamp display.
     * @default "time"
     */
    timestampKey?: string;
    /**
     * The minimum log level to include in the output.
     * @default "trace"
     */
    minimumLevel?: Level;
    /**
     * Format output of message, e.g. {level} - {pid} will output message: INFO - 1123
     * @default false
     *
     * @example
     * ```typescript
     * {
     *   messageFormat: (log, messageKey) => {
     *     const message = log[messageKey];
     *     if (log.requestId) return `[${log.requestId}] ${message}`;
     *     return message;
     *   }
     * }
     * ```
     */
    messageFormat?: false | string | MessageFormatFunc;
    /**
     * If set to true, will add color information to the formatted output message.
     * @default false
     */
    colorize?: boolean;
    /**
     * If set to false while `colorize` is `true`, will output JSON objects without color.
     * @default true
     */
    colorizeObjects?: boolean;
    /**
     * Appends carriage return and line feed, instead of just a line feed, to the formatted log line.
     * @default false
     */
    crlf?: boolean;
    /**
     * Define the log keys that are associated with error like objects.
     * @default ["err", "error"]
     *
     * Not required to handle custom errorKey when used with pino >= 8.21.0
     */
    errorLikeObjectKeys?: string[];
    /**
     *  When formatting an error object, display this list of properties.
     *  The list should be a comma separated list of properties.
     * @default ""
     */
    errorProps?: string;
    /**
     * Ignore one or several keys.
     * Will be overridden by the option include if include is presented.
     * @example "time,hostname"
     */
    ignore?: string;
    /**
     * Include one or several keys.
     * @example "time,level"
     */
    include?: string;
    /**
     * Makes messaging synchronous.
     * @default false
     */
    sync?: boolean;
    /**
     * The file, file descriptor, or stream to write to.  Defaults to 1 (stdout).
     * @default 1
     */
    destination?: string | number | DestinationStream | NodeJS.WritableStream;
    /**
     * Opens the file with the 'a' flag.
     * @default true
     */
    append?: boolean;
    /**
     * Ensure directory for destination file exists.
     * @default false
     */
    mkdir?: boolean;
    /**
     * Provides the ability to add a custom prettify function for specific log properties.
     * `customPrettifiers` is an object, where keys are log properties that will be prettified
     * and value is the prettify function itself.
     * For example, if a log line contains a query property, you can specify a prettifier for it:
     * @default {}
     *
     * @example
     * ```typescript
     * {
     *   customPrettifiers: {
     *     query: prettifyQuery
     *   }
     * }
     * //...
     * const prettifyQuery = value => {
     *  // do some prettify magic
     * }
     * ```
     */
    customPrettifiers?: Record<string, Prettifier> & {
        level?: Prettifier<LevelPrettifierExtras>;
    };
    /**
     * Change the level names and values to an user custom preset.
     *
     * Can be a CSV string in 'level_name:level_value' format or an object.
     *
     * @example ( CSV ) customLevels: 'info:10,some_level:40'
     * @example ( Object ) customLevels: { info: 10, some_level: 40 }
     *
     * Not required when used with pino >= 8.21.0
     */
    customLevels?: string | object;
    /**
     * Change the level colors to an user custom preset.
     *
     * Can be a CSV string in 'level_name:color_value' format or an object.
     * Also supports 'default' as level_name for fallback color.
     *
     * @example ( CSV ) customColors: 'info:white,some_level:red'
     * @example ( Object ) customColors: { info: 'white', some_level: 'red' }
     */
    customColors?: string | object;
    /**
     * Only use custom levels and colors (if provided); else fallback to default levels and colors.
     *
     * @default true
     */
    useOnlyCustomProps?: boolean;

    outputStream?: NodeJS.WritableStream;
}

/**
 * The default options that will be used when prettifying log lines.
 *
 * @type {PinoPrettyOptions}
 */
const defaultOptions: PinoPrettyOptions = {
    colorize: isColorSupported,
    colorizeObjects: true,
    crlf: false,
    customColors: undefined,
    customLevels: undefined,
    customPrettifiers: {},
    errorLikeObjectKeys: ERROR_LIKE_KEYS,
    errorProps: '',
    hideObject: false,
    ignore: 'hostname',
    include: undefined,
    levelFirst: false,
    levelKey: LEVEL_KEY,
    levelLabel: LEVEL_LABEL,
    messageFormat: undefined,
    messageKey: MESSAGE_KEY,
    minimumLevel: undefined,
    outputStream: process.stdout,
    singleLine: false,
    timestampKey: TIMESTAMP_KEY,
    translateTime: true,
    useOnlyCustomProps: true,
};

/**
 * Processes the supplied options and returns a function that accepts log data
 * and produces a prettified log string.
 *
 * @param {PinoPrettyOptions} options Configuration for the prettifier.
 * @returns {LogPrettifierFunc}
 */
export function prettyFactory(options: PinoPrettyOptions): OmitThisParameter<LogPrettifierFunc> {
    const context = parseFactoryOptions(Object.assign({}, defaultOptions, options));
    return pretty.bind({ ...context, context });
}

/**
 * Options for building the pino-pretty stream.
 */
export interface BuildStreamOpts extends PinoPrettyOptions {
    /** A destination stream, file descriptor, or target path to a file. */
    destination?: NodeJS.WritableStream | number | string;
    /** When true, append to the destination file. */
    append?: boolean;
    /** When true, create the destination directory if it doesn't exist. */
    mkdir?: boolean;
    /** When true, write to the destination synchronously. Default: `false`. */
    sync?: boolean;
}

/**
 * Constructs a {@link LogPrettifierFunc} and a stream to which the produced
 * prettified log data will be written.
 *
 * @param {BuildStreamOpts} opts
 * @returns {Transform | PrettyStream}
 */
export default function build(opts: BuildStreamOpts = {}): Transform | PrettyStream {
    let pretty = prettyFactory(opts);
    let destination: SonicBoom | NodeJS.WritableStream;
    return abstractTransport(
        (source) => {
            source.on('message', function pinoConfigListener(message) {
                if (!message || message.code !== 'PINO_CONFIG') return;
                Object.assign(opts, {
                    messageKey: message.config.messageKey,
                    errorLikeObjectKeys: Array.from(
                        new Set([...(opts.errorLikeObjectKeys || ERROR_LIKE_KEYS), message.config.errorKey]),
                    ),
                    customLevels: message.config.levels.values,
                });
                pretty = prettyFactory(opts);
                source.off('message', pinoConfigListener);
            });
            const stream = new Transform({
                objectMode: true,
                autoDestroy: true,
                transform(chunk, enc, cb) {
                    const line = pretty(chunk);
                    cb(null, line);
                },
            });

            if (typeof opts.destination === 'object' && typeof opts.destination.write === 'function') {
                destination = opts.destination;
            } else {
                destination = buildSafeSonicBoom({
                    dest: (opts.destination as string | number | undefined) || 1,
                    append: opts.append,
                    mkdir: opts.mkdir,
                    sync: opts.sync, // by default sonic will be async
                });
            }

            source.on('unknown', (line) => {
                destination.write(line + '\n');
            });

            pump(source, stream, destination);
            return stream;
        },
        {
            parse: 'lines',
            close(err, cb) {
                destination.on('close', () => {
                    cb(err);
                });
            },
        },
    );
}

export { build, build as PinoPretty };
export { colors as colorizerFactory };
export { isColorSupported };

// module.exports = build
// module.exports.build = build
// module.exports.PinoPretty = build
// module.exports.prettyFactory = prettyFactory
// module.exports.colorizerFactory = colors
// module.exports.isColorSupported = isColorSupported
// module.exports.default = build
