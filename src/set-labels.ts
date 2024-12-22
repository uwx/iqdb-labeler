import { type ComAtprotoLabelDefs } from '@atproto/api';
import { type LoginCredentials, setLabelerLabelDefinitions } from '@skyware/labeler/scripts';

import { BSKY_IDENTIFIER, BSKY_PASSWORD } from './config.js';
import { getLabelValueDefinitions, injectDanbooruTags } from './labels/index.js';
import logger from './logger.js';
import { arrayFromAsync } from './utils.js';

const loginCredentials: LoginCredentials = {
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD,
};

// logger.info('injecting danbooru tags');
// console.time('injecting danbooru tags');
// await injectDanbooruTags();
// console.timeEnd('injecting danbooru tags');
// logger.info('injected danbooru tags');

try {
    console.time('setLabelerLabelDefinitions');
    await setLabelerLabelDefinitions(loginCredentials, (await arrayFromAsync(getLabelValueDefinitions())).slice(0, 500));
    console.timeEnd('setLabelerLabelDefinitions');
    logger.info('Label definitions set successfully.');
} catch (error) {
    logger.error(`Error setting label definitions: ${error}`);
}
