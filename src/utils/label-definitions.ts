import { BSKY_IDENTIFIER, BSKY_PASSWORD } from "../config.js";
import { getLabelerLabelDefinitions } from "#skyware/labeler/scripts/index.js";
import { credentialManager } from "../session.js";

/**
 * The currently defined label definitions for this bot.
 */
export const labelDefinitions = Object.fromEntries((await getLabelerLabelDefinitions({
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD,
    credentialManager
}))!.map(labelDef => [labelDef.identifier, labelDef]));
