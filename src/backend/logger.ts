/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path';
import { pino } from 'pino';
import type { PinoPretty } from 'pino-pretty';

const STACKTRACE_OFFSET = 2;
const { symbols: { asJsonSym } } = pino;

function extractStuff(line: string | undefined) {
    const match = line?.match(/^\s*at +(.*?) \(\\*(.*):(\d+):(\d+)\)/);
    if (match) {
        // eslint-disable-next-line prefer-const
        let [, method, path, lineNumber, position] = match;
        // method = method.replace(/<anonymous>/g, '(anonymous)');
        path = path.replace(/\\/g, '/');

        return `${path}#${method}:${lineNumber}:${position}`;
    } else {
        return undefined;
    }
}

// https://gist.github.com/miguelmota/4df504cff4bfebcff982dd06bde7a34a
const baseDir = path.resolve(import.meta.dirname, '..');
function traceCaller<CustomLevels extends string = never, UseOnlyCustomLevels extends boolean = boolean>(pinoInstance: pino.Logger<CustomLevels, UseOnlyCustomLevels>): pino.Logger<CustomLevels, UseOnlyCustomLevels> {
    const get = (target: any, p: string | symbol) => p === asJsonSym ? asJson : target[p];

    // @ts-expect-error fuck you
    const origAsJson = pinoInstance[asJsonSym];

    function asJson(this: pino.Logger<CustomLevels, UseOnlyCustomLevels>, ...args: unknown[]) {
        args[0] = args[0] || Object.create(null);
        (args[0] as any).caller = extractStuff(new Error().stack
            ?.split('\n')
            .filter(s => !s.includes('node_modules/pino') && !s.includes('node_modules\\pino'))[STACKTRACE_OFFSET]
            .replace(baseDir, ''));

        return origAsJson.apply(this, args)
    }

    return new Proxy(pinoInstance, { get });
}

const logger = traceCaller(pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
        process.env.NODE_ENV !== 'production' ?
            {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss Z',
                    ignore: 'pid,hostname',
                } satisfies PinoPretty.PrettyOptions,
            }
            : undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
}));

export default logger;
