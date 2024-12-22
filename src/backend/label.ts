// import { DELETE, LABELS, LABEL_LIMIT } from './constants.js';
import logger from './logger.js';
import { bot } from './bot.js';
import { Post } from '#skyware/bot';
import { AppBskyFeedPost } from '@atcute/client/lexicons';
import { matchers } from '../taggers/index.js';
import { getSanitizedTagName, getTag } from '../labels/index.js';
import { labelDefinitions } from '../utils/label-definitions.js';
import { inspect } from 'node:util';
import { BACKEND_DOMAIN } from '../config.js';
import { aesEncrypt } from './crypto.js';
import { db } from './db.js';
import { Tag } from './db/types.js';

//labelerServer.app.addHook('onRequest', request => {
//    console.log(`onRequest`, request);
//})

export async function labelPost(post: Post | (AppBskyFeedPost.Record & { uri: string, cid: string }) | string) {
    const uri = typeof post === 'string' ? post : post.uri;
    logger.info(`Trying to label ${uri}`);

    if (!uri.includes('app.bsky.feed.post')) {
        logger.warn(`Cannot label ${uri}: it's not a post`);
        return;
    }

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

    if (images.length == 0) {
        logger.debug('No images');
        return;
    }

    const labels = new Set<number>();

    for (const imageUrl of images) {
        let match = await db
            .selectFrom('Match')
            .selectAll()
            .where('Match.url', '=', imageUrl)
            .executeTakeFirst();

        if (!match) {
            for (const [matcher, matchCandidate] of await Promise.all(
                matchers.map(async matcher => [matcher, await matcher.getMatch(imageUrl)] as const)
            )) {
                if (matchCandidate) {
                    if ('error' in matchCandidate) {
                        // console.error(matchCandidate['error']);
                        logger.error({error: matchCandidate['error']}, `During ${imageUrl} matching for ${matcher.constructor.name}`)
                    } else {
                        match = {
                            url: imageUrl,

                            similarity: matchCandidate.similarity,

                            md5: matchCandidate.md5 ?? null,
                            sha1: matchCandidate.sha1 ?? null,
                            sha256: matchCandidate.sha256 ?? null,
                            rating: matchCandidate.rating ?? null,
                            sourceUrl: matchCandidate.sourceUrl ?? null,
                            pixivId: matchCandidate.pixivId ?? null,
                            fileSize: matchCandidate.fileSize ?? null,

                            tags: JSON.stringify(matchCandidate.tags),
                        };

                        await db
                            .insertInto('Match')
                            .values(match)
                            .onConflict(oc => oc
                                .column('url')
                                .doUpdateSet({
                                    similarity: matchCandidate.similarity,
        
                                    md5: matchCandidate.md5 ?? null,
                                    sha1: matchCandidate.sha1 ?? null,
                                    sha256: matchCandidate.sha256 ?? null,
                                    rating: matchCandidate.rating ?? null,
                                    sourceUrl: matchCandidate.sourceUrl ?? null,
                                    pixivId: matchCandidate.pixivId ?? null,
                                    fileSize: matchCandidate.fileSize ?? null,
        
                                    tags: JSON.stringify(matchCandidate.tags),
                                }))
                            .execute();
                        
                        break;
                    }
                }
            }
        }

        if (match?.tags) {
            for (const tagId of JSON.parse(match.tags)) {
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
        async function getActualLabels(labelIds: Set<number>) {
            const tags: Tag[] = [];

            for (const labelId of labelIds) {
                const tag = await getTag(labelId);
                if (tag === undefined) continue;
                tags.push(tag);
            }

            return tags
                .sort((a, b) => a.name?.localeCompare(b.name ?? '') ?? -1)
                .map(tag => getSanitizedTagName(tag))
                .filter(labelId => labelId in labelDefinitions);
        }

        await addLabels(post.uri, await getActualLabels(labels), post.cid);
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
        const res = await fetch(`http://${BACKEND_DOMAIN}/label`, {
            method: 'POST',
            body: await aesEncrypt(JSON.stringify({
                reference: { uri, cid },
                labels: identifiers
            }), { outString: true })
        });

        if (!res.ok) {
            throw new Error(`${res.status}: ${res.statusText}\n\n${await res.text()}`);
        }

        // logger.debug(await res.json());

        logger.info(`Successfully labeled ${uri} with ${identifiers.map(e => labelDefinitions[e].locales[0].name).join(', ')}`);
    } catch (error) {
        logger.error(inspect(error), `Error adding new label: ${error}`);
    }
}
