import formatTime from './format-time';
import type { PrettyContext } from './parse-factory-options';

interface PrettifyTimeParams {
    /** The log object with the timestamp to be prettified. */
    log: object;
    /** The context object built from parsing the options. */
    context: PrettyContext;
}

/**
 * Prettifies a timestamp if the given `log` has either `time`, `timestamp` or custom specified timestamp
 * property.
 *
 * @param {PrettifyTimeParams} input
 *
 * @returns {undefined|string} If a timestamp property cannot be found then
 * `undefined` is returned. Otherwise, the prettified time is returned as a
 * string.
 */
export default function prettifyTime({ log, context }: PrettifyTimeParams): undefined | string {
    const { timestampKey, translateTime: translateFormat } = context;
    const prettifier = context.customPrettifiers?.time;
    let time = null;

    if (timestampKey in log) {
        time = log[timestampKey];
    } else if ('timestamp' in log) {
        time = log.timestamp;
    }

    if (time === null) return undefined;
    const output = translateFormat ? formatTime(time, translateFormat) : time;

    return prettifier ? prettifier(output) : `[${output}]`;
}
