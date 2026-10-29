import { BSKY_IDENTIFIER, PDS } from '../config.js';
import { getLabelerLabelDefinitions } from '../tools/util/declareLabeler.js';

/**
 * The currently defined label definitions for this bot.
 */
export const labelDefinitions = Object.fromEntries(
    (await getLabelerLabelDefinitions({
        identifier: BSKY_IDENTIFIER,
        pds: PDS,
    }))!.map((labelDef) => [labelDef.identifier, labelDef]),
);
