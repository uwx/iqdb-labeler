import { AppBskyActorDefs, ComAtprotoLabelDefs } from '@atproto/api';
import { LabelerServer } from './labeler/src/index.js';

import { BSKY_IDENTIFIER, BSKY_PASSWORD, DID, SIGNING_KEY } from './config.js';
// import { DELETE, LABELS, LABEL_LIMIT } from './constants.js';
import logger from './logger.js';
import { bot } from './bot.js';
import { Post } from '@skyware/bot';
import { AppBskyFeedPost } from '@atcute/client/lexicons';
import { matchers } from './taggers/index.js';
import { table } from './lmdb.js';
import { Match } from './taggers/matcher.js';
import { getLabelIdForTag } from './labels/index.js';
import { getLabelerLabelDefinitions } from '@skyware/labeler/scripts';

//labelerServer.app.addHook('onRequest', request => {
//    console.log(`onRequest`, request);
//})

const matchesByUrl = table<string, Match>('matches', 'ordered-binary');

const labelDefinitions = Object.fromEntries((await getLabelerLabelDefinitions({
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD,
}))!.map(e => [e.identifier, e]));

export async function labelPost(post: Post | (AppBskyFeedPost.Record & { uri: string, cid: string }) | string) {
    const uri = typeof post === 'string' ? post : post.uri;
    logger.info(`Trying to label ${uri}`);

    if (typeof post === 'string') {
        post = await bot.getPost(post);
    }

    const images: string[] = [];

    if (post.embed) {
        if ('isImages' in post.embed) {
            if (post.embed.isImages()) {
                for (const image of post.embed.images) {
                    if (image.url) images.push(image.url);
                }
            }
        } else if ('images' in post.embed) {
            for (const image of post.embed.images) {
                images.push(image.image.ref.$link);
            }
        }
    }

    const labels = new Set<number>();

    for (const imageUrl of images) {
        let match = matchesByUrl.get(imageUrl);
        if (!match) {
            for (const matcher of matchers) {
                const matchCandidate = await matcher.getMatch(imageUrl);
                if (matchCandidate) {
                    if ('error' in matchCandidate) {
                        logger.error(`matcher ${matcher.constructor.name} error: ${matchCandidate.error}`);
                    } else {
                        matchesByUrl.put(imageUrl, matchCandidate);
                        match = matchCandidate;
                        break;
                    }
                }
            }
        }

        if (match) {
            for (const tagId of match.tags) {
                labels.add(tagId);
            }
        }
    }

    //await bot.label({
    //    reference: { uri: post.uri, cid: post.cid },
    //    labels: [...labels].map(getLabelIdForTag)
    //        .filter(e => e !== undefined)
    //        .filter(e => e in labelDefinitions),
    //});

    if (labels.size > 0) {
        await addLabels(post.uri, [...labels].map(getLabelIdForTag)
            .filter(e => e !== undefined)
            .filter(e => e in labelDefinitions), post.cid);
    } else {
        logger.info('No matches');
    }
}

// export const label = async (subject: string | AppBskyActorDefs.ProfileView, rkey: string) => {
//     const did = AppBskyActorDefs.isProfileView(subject) ? subject.did : subject;
//     logger.info(`Received rkey: ${rkey} for ${did}`);
//
//     if (rkey === 'self') {
//         logger.info(`${did} liked the labeler. Returning.`);
//         return;
//     }
//     try {
//         const labels = fetchCurrentLabels(did);
//
//         if (rkey.includes(DELETE)) {
//             await deleteAllLabels(did, labels);
//         } else {
//             await addOrUpdateLabel(did, rkey, labels);
//         }
//     } catch (error) {
//         logger.error(`Error in \`label\` function: ${error}`);
//     }
// };
//
// function fetchCurrentLabels(did: string) {
//     const query = labelerServer.db.prepare<string>(`SELECT * FROM labels WHERE uri = ?`).all(did) as ComAtprotoLabelDefs.Label[];
//
//     const labels = query.reduce((set, label) => {
//         if (!label.neg) set.add(label.val);
//         else set.delete(label.val);
//         return set;
//     }, new Set<string>());
//
//     if (labels.size > 0) {
//         logger.info(`Current labels: ${Array.from(labels).join(', ')}`);
//     }
//
//     return labels;
// }
//
// async function deleteAllLabels(did: string, labels: Set<string>) {
//     const labelsToDelete: string[] = Array.from(labels);
//
//     if (labelsToDelete.length === 0) {
//         logger.info(`No labels to delete`);
//     } else {
//         logger.info(`Labels to delete: ${labelsToDelete.join(', ')}`);
//         try {
//             await labelerServer.createLabels({ uri: did }, { negate: labelsToDelete });
//             logger.info('Successfully deleted all labels');
//         } catch (error) {
//             logger.error(`Error deleting all labels: ${error}`);
//         }
//     }
// }

async function addLabels(uri: string, identifiers: string[], cid: string) {
    logger.info(`New labels: ${identifiers.join(', ')}`);

    try {
        await bot.label({
            reference: { uri, cid },
            labels: identifiers
        });

        logger.info(`Successfully labeled ${uri} with ${identifiers.map(e => labelDefinitions[e].locales[0].name).join(', ')}`);
    } catch (error) {
        logger.error(`Error adding new label: ${error}`);
    }
}
