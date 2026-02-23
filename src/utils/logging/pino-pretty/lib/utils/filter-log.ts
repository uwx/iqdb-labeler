import { createCopier } from 'fast-copy';
const fastCopy = createCopier({});

import deleteLogProperty from './delete-log-property';

interface FilterLogParams {
    log: object;
    context: PrettyContext;
}

/**
 * Filter a log object by removing or including keys accordingly.
 * When `includeKeys` is passed, `ignoredKeys` will be ignored.
 * One of ignoreKeys or includeKeys must be pass in.
 *
 * @param {FilterLogParams} input
 *
 * @returns {object} A new `log` object instance that
 *  either only includes the keys in ignoreKeys
 *  or does not include those in ignoredKeys.
 */
export default function filterLog({ log, context }: FilterLogParams): object {
    const { ignoreKeys, includeKeys } = context;
    const logCopy = fastCopy(log);

    if (includeKeys) {
        const logIncluded = {};

        includeKeys.forEach((key) => {
            logIncluded[key] = logCopy[key];
        });
        return logIncluded;
    }

    ignoreKeys.forEach((ignoreKey) => {
        deleteLogProperty(logCopy, ignoreKey);
    });
    return logCopy;
}
