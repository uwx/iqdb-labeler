import { LOGGER_KEYS } from '../constants';

// import stringifySafe from 'fast-safe-stringify';
import joinLinesWithIndentation from './join-lines-with-indentation';
import prettifyError from './prettify-error';
import type { PrettyContext } from './parse-factory-options';
import { inspect } from 'node:util';

interface PrettifyObjectParams {
    /** The object to prettify. */
    log: object;
    /** Indicates if known logger specific keys should be excluded from prettification. Default: `true`. */
    excludeLoggerKeys?: boolean;
    /** A set of object keys to exclude from the prettified result. Default: `[]`. */
    skipKeys?: string[];
    /** The context object built from parsing the options. */
    context: PrettyContext;
}

function stringifySafe(value: any, replacer?: (key: string, value: any) => any, space?: string | number) {
    return inspect(value, {
        colors: true,
        depth: Infinity,
        maxArrayLength: 10,
        compact: false,
        numericSeparator: true,
    });
}

/**
 * Prettifies a standard object. Special care is taken when processing the object
 * to handle child objects that are attached to keys known to contain error
 * objects.
 *
 * @param {PrettifyObjectParams} input
 *
 * @returns {string} The prettified string. This can be as little as `''` if
 * there was nothing to prettify.
 */
export default function prettifyObject({
    log,
    excludeLoggerKeys = true,
    skipKeys = [],
    context,
}: PrettifyObjectParams): string {
    const {
        EOL: eol,
        IDENT: ident,
        customPrettifiers,
        errorLikeObjectKeys: errorLikeKeys,
        objectColorizer,
        singleLine,
        colorizer,
    } = context;
    const keysToIgnore = ([] as string[]).concat(skipKeys);

    /* istanbul ignore else */
    if (excludeLoggerKeys === true) Array.prototype.push.apply(keysToIgnore, LOGGER_KEYS);

    let result = '';

    // Split object keys into two categories: error and non-error
    const { plain, errors } = Object.entries(log).reduce(
        ({ plain, errors }, [k, v]) => {
            if (keysToIgnore.includes(k) === false) {
                // Pre-apply custom prettifiers, because all 3 cases below will need this
                const pretty =
                    typeof customPrettifiers[k] === 'function'
                        ? customPrettifiers[k](v, k, log, { colors: colorizer.colors })
                        : v;
                if (errorLikeKeys.includes(k)) {
                    errors[k] = pretty;
                } else {
                    plain[k] = pretty;
                }
            }
            return { plain, errors };
        },
        { plain: {}, errors: {} },
    );

    if (singleLine) {
        // Stringify the entire object as a single JSON line
        /* istanbul ignore else */
        if (Object.keys(plain).length > 0) {
            result += objectColorizer.greyMessage(stringifySafe(plain));
        }
        result += eol;
        // Avoid printing the escape character on escaped backslashes.
        result = result.replace(/\\\\/gi, '\\');
    } else {
        // Put each object entry on its own line
        Object.entries(plain).forEach(([keyName, keyValue]) => {
            // custom prettifiers are already applied above, so we can skip it now
            let lines = typeof customPrettifiers[keyName] === 'function' ? keyValue : stringifySafe(keyValue, null, 2);

            if (lines === undefined) return;

            // Avoid printing the escape character on escaped backslashes.
            lines = lines.replace(/\\\\/gi, '\\');

            const joinedLines = joinLinesWithIndentation({ input: lines, ident, eol });
            result += `${ident}${objectColorizer.property(keyName)}:${joinedLines.startsWith(eol) ? '' : ' '}${joinedLines}${eol}`;
        });
    }

    // Errors
    Object.entries(errors).forEach(([keyName, keyValue]) => {
        // custom prettifiers are already applied above, so we can skip it now
        const lines = typeof customPrettifiers[keyName] === 'function' ? keyValue : stringifySafe(keyValue, null, 2);

        if (lines === undefined) return;

        result += prettifyError({ keyName, lines, eol, ident });
    });

    return result;
}
