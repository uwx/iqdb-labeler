/**
 * A set of property names that indicate the value represents an error object.
 */
type K_ERROR_LIKE_KEYS = string[];

export const DATE_FORMAT = 'yyyy-mm-dd HH:MM:ss.l o';
export const DATE_FORMAT_SIMPLE = 'HH:MM:ss.l';

/**
 * @type {K_ERROR_LIKE_KEYS}
 */
export const ERROR_LIKE_KEYS: K_ERROR_LIKE_KEYS = ['err', 'error'];

export const MESSAGE_KEY = 'msg';

export const LEVEL_KEY = 'level';

export const LEVEL_LABEL = 'levelLabel';

export const TIMESTAMP_KEY = 'time';

export const LEVELS = {
    default: 'USERLVL',
    60: 'FATAL',
    50: 'ERROR',
    40: 'WARN',
    30: 'INFO',
    20: 'DEBUG',
    10: 'TRACE',
};

export const LEVEL_NAMES = {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    debug: 20,
    trace: 10,
};

// Object keys that probably came from a logger like Pino or Bunyan.
export const LOGGER_KEYS = ['pid', 'hostname', 'name', 'level', 'time', 'timestamp', 'caller'];
