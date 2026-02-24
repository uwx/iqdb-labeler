import { BSKY_IDENTIFIER, BSKY_PASSWORD,PDS } from '../config.js';
import { getLabelValueDefinitions, injectDanbooruTags } from '../labels/index.js';
import logger from '../backend/logger.js';
import { arrayFromAsync } from '../utils.js';
import { LoginCredentials } from './util/index.js';
import { setLabelerLabelDefinitions } from './util/declareLabeler.js';

const loginCredentials: LoginCredentials = {
    pds: PDS,
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD
};

if (process.argv.slice(2).includes('--inject-danbooru-tags')) {
    logger.info('injecting danbooru tags');
    console.time('injecting danbooru tags');
    await injectDanbooruTags();
    console.timeEnd('injecting danbooru tags');
    logger.info('injected danbooru tags');
}

try {
    console.time('setLabelerLabelDefinitions');
    logger.info('Setting label definitions.');
    await setLabelerLabelDefinitions(
        loginCredentials,
        (await arrayFromAsync(getLabelValueDefinitions()))
            .slice(0, 550)
            .sort((a, b) => a.locales[0].name.localeCompare(b.locales[0].name)));
    console.timeEnd('setLabelerLabelDefinitions');
    logger.info('Label definitions set successfully.');
} catch (error) {
    logger.error(`Error setting label definitions: ${error}`);
}
