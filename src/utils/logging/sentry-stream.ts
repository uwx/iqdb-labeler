import {
    type NodeOptions,
    Scope,
    type SeverityLevel,
    captureException,
    captureMessage,
    getClient,
    init,
} from '@sentry/node';

function deserializePinoError(pinoErr: { message: string; stack: string; cause: any }) {
    const { message, stack, cause } = pinoErr;
    const newError = new Error(message);
    newError.stack = stack;
    if (cause) newError.cause = deserializePinoError(cause);
    return newError;
}

function pinoLevelToSentryLevel(level: number): SeverityLevel {
    if (level === 60) {
        return 'fatal';
    }
    if (level >= 50) {
        return 'error';
    }
    if (level >= 40) {
        return 'warning';
    }
    if (level >= 30) {
        return 'log';
    }
    if (level >= 20) {
        return 'info';
    }
    return 'debug';
}

init({
    dsn: process.env.SENTRY_DSN,

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
});

export default {
    write(msg: string) {
        const obj = JSON.parse(msg);
        const { level, msg: message, err: error, time, pid, hostname, category, id, startTime, caller, ...rest } = obj;
        const scope = new Scope();
        scope.setLevel(pinoLevelToSentryLevel(level));
        scope.setExtras({
            time,
            pid,
            hostname,
            category,
            id,
            startTime,
            caller,
        });
        scope.setContext('rest', rest);

        if (level < 50 /* error */ || !error) {
            captureException(new Error(message), scope);
        } else {
            if (msg) scope.setExtra('msg', message);
            captureException(deserializePinoError(error), scope);
        }
    },
};
