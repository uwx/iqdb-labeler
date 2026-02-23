/* eslint-disable @typescript-eslint/no-explicit-any */

import { fileURLToPath } from 'node:url';
import { getCallSites, type CallSiteObject } from 'node:util';
import { multistream, pino } from 'pino';
import * as pinoNs from 'pino';
import path from 'node:path';
import wsStream from './ws-stream';
import { formatCaller, formatTimeSpan } from './utils';
import * as colors from 'colorette';
import { Writable } from 'node:stream';
import sentryStream from './sentry-stream';
import pinoPretty from './pino-pretty';

const STACKTRACE_OFFSET = 1;

const baseDir = path.resolve('.');

const startTime = new Date();

let id = 0;

// const ws = wsStream();

const logger = pino(
    {
        level: 'trace',
        timestamp: pino.stdTimeFunctions.isoTime,
        mixin(mergeObject, level, logger) {
            const callSite = getCallSites({ sourceMap: true }).filter(
                (s) => !s.scriptName.includes('node_modules/pino') && !s.scriptName.includes('node_modules\\pino'),
            )[STACKTRACE_OFFSET];

            return {
                caller: {
                    ...callSite,
                    path: path.relative(baseDir, fileURLToPath(callSite.scriptName)),
                },
                id: id++,
                startTime: startTime.getTime(),
            };
        },
    },
    multistream([
        // {
        //     level: 'trace',
        //     stream: ws,
        // },
        {
            level: 'trace',
            stream: pinoPretty({
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
                ignore: 'pid,hostname,category,id,startTime',
                messageFormat(log, messageKey, levelLabel, extras) {
                    return log.category ? `${colors.gray(log.category as string | undefined ?? 'General')} ${log[messageKey]}` : log[messageKey] as string;
                },
                customPrettifiers: {
                    caller: (caller) => colors.gray(formatCaller(caller as CallSiteObject & { path: string })),
                    time: (timestamp) => colors.gray(formatTimeSpan(new Date(`${timestamp}`).getTime() - startTime.getTime())),
                    // category: (category) => colors.gray(String(category)),
                    level: (level) => ({
                        10: '🔍',
                        20: '🐛',
                        30: '✨',
                        40: '⚠️',
                        50: '🚨',
                        60: '💀',
                    }[level as any as number])!
                },
            }),
        },
        {
            level: 'error',
            stream: sentryStream,
        },
    ]),
);

Object.defineProperty(logger, 'terminate', {
    value: () => {
        // ws.terminate();
    },
});

export default logger as pinoNs.Logger & { terminate: () => void };
