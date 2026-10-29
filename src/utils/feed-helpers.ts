import { getLabelIdForTag, parseLabelIdentifier } from '../labels/index.js';
import { alphabetParseInt, alphabetToString } from './ints.js';

export function getFeedRkeyFromLabelIdentifier(labelIdentifier: string) {
    return alphabetToString(parseLabelIdentifier(labelIdentifier)[0]);
}

export async function getLabelIdentifierFromFeedRkey(rkey: string) {
    if (/[^a-z]/.test(rkey)) throw new Error('rkey is not valid! contains characters outside the base-26 alphabet');
    return await getLabelIdForTag(alphabetParseInt(rkey));
}
