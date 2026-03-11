import type { LogDescriptor } from 'pino';
import type { PrettifierExtras } from '../../index.js';

export { default as buildSafeSonicBoom } from './build-safe-sonic-boom.js';
export { default as createDate } from './create-date.js';
export { default as deleteLogProperty } from './delete-log-property.js';
export { default as filterLog } from './filter-log.js';
export { default as formatTime } from './format-time.js';
export { default as getPropertyValue } from './get-property-value.js';
export { default as handleCustomLevelsNamesOpts } from './handle-custom-levels-names-opts.js';
export { default as handleCustomLevelsOpts } from './handle-custom-levels-opts.js';
export { default as interpretConditionals } from './interpret-conditionals.js';
export { default as isObject } from './is-object.js';
export { default as isValidDate } from './is-valid-date.js';
export { default as joinLinesWithIndentation } from './join-lines-with-indentation.js';
export { default as noop } from './noop.js';
export { default as parseFactoryOptions } from './parse-factory-options.js';
export { default as prettifyErrorLog } from './prettify-error-log.js';
export { default as prettifyError } from './prettify-error.js';
export { default as prettifyLevel } from './prettify-level.js';
export { default as prettifyMessage } from './prettify-message.js';
export { default as prettifyMetadata } from './prettify-metadata.js';
export { default as prettifyObject } from './prettify-object.js';
export { default as prettifyTime } from './prettify-time.js';
export { default as splitPropertyKey } from './split-property-key.js';
export { default as getLevelLabelData } from './get-level-label-data';

// The remainder of this file consists of jsdoc blocks that are difficult to
// determine a more appropriate "home" for. As an example, the blocks associated
// with custom prettifiers could live in either the `prettify-level`,
// `prettify-metadata`, or `prettify-time` files since they are the primary
// files where such code is used. But we want a central place to define common
// doc blocks, so we are picking this file as the answer.

/**
 * A synchronous function to be used for prettifying a log property. It must
 * return a string.
 */
export type CustomPrettifierFunc = (value: any) => string;

/**
 * A hash of log property names mapped to prettifier functions. When the
 * incoming log data is being processed for prettification, any key on the log
 * that matches a key in a custom prettifiers hash will be prettified using
 * that matching custom prettifier. The value passed to the custom prettifier
 * will the value associated with the corresponding log key.
 *
 * The hash may contain any arbitrary keys for arbitrary log properties,
 * but it may also contain a set of predefined key names that map to
 * well-known log properties. These keys are:
 *
 * + `time` (for the timestamp field)
 * + `level` (for the level label field; value may be a level number instead
 * of a level label)
 * + `hostname`
 * + `pid`
 * + `name`
 * + `caller`
 */
export type CustomPrettifiers = Record<string, CustomPrettifierFunc>;

/**
 * A tokenized string that indicates how the prettified log line should be
 * formatted. Tokens are either log properties enclosed in curly braces, e.g.
 * `{levelLabel}`, `{pid}`, or `{req.url}`, or conditional directives in curly
 * braces. The only conditional directives supported are `if` and `end`, e.g.
 * `{if pid}{pid}{end}`; every `if` must have a matching `end`. Nested
 * conditions are not supported.
 *
 * @example
 * `{levelLabel} - {if pid}{pid} - {end}url:{req.url}`
 */
export type MessageFormatString = string;

/**
 * @property {object} colors Available color functions based on `useColor` (or `colorize`) context
 * the options.
 */
export interface PrettifyMessageExtras {
    colors: Record<string, any>; // Or a more specific type if you know the structure of 'colors'
}

/**
 * A function that accepts a log object, name of the message key, and name of
 * the level label key and returns a formatted log line.
 *
 * Note: this function must be synchronous.
 *
 * @example
 * function (log, messageKey, levelLabel) {
 *   return `${log[levelLabel]} - ${log[messageKey]}`
 * }
 */
export type MessageFormatFunction = (
    log: LogDescriptor,
    messageKey: string,
    levelLabel: string,
    extras: PrettifierExtras,
) => string;
