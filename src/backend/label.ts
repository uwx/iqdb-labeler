// import { DELETE, LABELS, LABEL_LIMIT } from './constants.js';
import logger from './logger.js';
import { matchers } from '../taggers/index.js';
import { Match } from '../taggers/matcher.js';
import { getLabelIdForTag } from '../labels/index.js';
import { labelDefinitions } from '../utils/label-definitions.js';
import { inspect } from 'node:util';
import { BACKEND_DOMAIN, DB_PATH } from '../config.js';
import { aesEncrypt } from './crypto.js';
import { AppBskyFeedPost } from '@atcute/bluesky';
import { KittyAgent } from 'kitty-agent';
import { Blob, Did, Handle, LegacyBlob, parseResourceUri } from '@atcute/lexicons';
import { createDb } from './kysely/index.js';
import {
    CompositeDidDocumentResolver,
    CompositeHandleResolver,
    DohJsonHandleResolver,
    WellKnownHandleResolver,
} from '@atcute/identity-resolver';

//labelerServer.app.addHook('onRequest', request => {
//    console.log(`onRequest`, request);
//})

const db = createDb(DB_PATH);

const agent = KittyAgent.createAppview();

function getBlobCid(blob: Blob | LegacyBlob) {
    if ('cid' in blob) return blob.cid;
    if ('ref' in blob) return blob.ref.$link;
    throw new Error('No CID found');
}

const handleResolver = new CompositeHandleResolver({
    methods: {
        dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
        http: new WellKnownHandleResolver(),
    },
});

export async function labelPost(post: (AppBskyFeedPost.Main & { uri: string; cid: string }) | string) {
    const uri = typeof post === 'string' ? post : post.uri;
    logger.info(`Trying to label ${uri}`);

    if (!uri.includes('app.bsky.feed.post')) {
        logger.warn(`Cannot label ${uri}: it's not a post`);
        return;
    }

    if (typeof post === 'string') {
        const result = parseResourceUri(post);
        if (!result.ok) {
            logger.error(`Failed to parse URI ${post}: ${result.error}`);
            return;
        }
        if (!result.value.rkey) {
            logger.error(`Failed to parse URI ${post}: no rkey`);
            return;
        }
        const gotRecord = await agent.getRecord({
            collection: 'app.bsky.feed.post',
            rkey: result.value.rkey,
            repo: result.value.repo,
        });
        post = {
            ...gotRecord.value,
            uri: gotRecord.uri.toString(),
            cid: gotRecord.cid!,
        };
    }

    const images: string[] = [];

    if (post.embed) {
        if ('images' in post.embed) {
            for (const image of post.embed.images) {
                images.push(getBlobCid(image.image));
            }
        }
    }

    if (images.length == 0) {
        logger.debug(`No images in ${post.uri}`);
        return;
    }

    const labels = new Set<bigint>();

    let authorDid: Did;
    {
        const postUri = parseResourceUri(post.uri);
        if (!postUri.ok) {
            logger.error(`Failed to parse post URI ${post.uri}: ${postUri.error}`);
            return;
        }
        const repo = postUri.value.repo;
        if (!repo.startsWith('did:')) {
            authorDid = await handleResolver.resolve(repo as Handle);
        } else {
            authorDid = repo as Did;
        }
    }

    for (const imageCid of images) {
        const queryResult = await db
            .selectFrom('matches')
            .selectAll()
            .where('imageUrl', '=', imageCid)
            .executeTakeFirst();
        let match: Match | undefined = queryResult
            ? {
                  ...queryResult,
                  tags: (JSON.parse(queryResult.tags) as number[]).map((id) => BigInt(id)),
              }
            : undefined;

        if (!match) {
            const imageUrl = `https://cdn.bsky.app/img/feed_thumbnail/plain/${authorDid}/${imageCid}@jpeg`;
            logger.debug(imageUrl);

            for (const [matcher, matchCandidate] of await Promise.all(
                matchers.map(async (matcher) => [matcher, await matcher.getMatch(imageUrl)] as const),
            )) {
                if (matchCandidate) {
                    if ('error' in matchCandidate) {
                        console.error(matchCandidate['error']);
                        logger.error(
                            { error: inspect(matchCandidate['error']) },
                            `During ${imageCid} matching for ${matcher.constructor.name}`,
                        );
                    } else {
                        await db
                            .insertInto('matches')
                            .values({
                                imageUrl: imageCid,
                                ...matchCandidate,
                                tags: JSON.stringify(matchCandidate.tags, (_, value) =>
                                    typeof value === 'bigint' ? Number(value) : value,
                                ),
                            })
                            .execute();
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
        const labelIdsToAdd = await db
            .selectFrom('tags')
            .select(['id', 'name'])
            .where('id', 'in', [...labels])
            .execute()
            .then((result) =>
                result
                    .sort((a, b) => a.name?.localeCompare(b.name ?? '') ?? -1)
                    .map((tag) => getLabelIdForTag(tag))
                    .filter((labelId) => labelId in labelDefinitions),
            );

        await addLabels(post.uri, labelIdsToAdd, post.cid);
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
            body: await aesEncrypt(
                JSON.stringify({
                    reference: { uri, cid },
                    labels: identifiers,
                }),
                { outString: true },
            ),
        });

        if (!res.ok) {
            throw new Error(`${res.status}: ${res.statusText}\n\n${await res.text()}`);
        }

        // logger.debug(await res.json());

        logger.info(
            `Successfully labeled ${uri} with ${identifiers.map((e) => labelDefinitions[e].locales[0].name).join(', ')}`,
        );
    } catch (error) {
        logger.error(error, `Error adding new label: ${error}`);
    }
}
