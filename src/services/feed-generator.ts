import { AuthRequiredError, InvalidRequestError, XRPCRouter, json } from '@atcute/xrpc-server';
import { FEEDS_DOMAIN } from '../config.js';
import { labelDefinitions } from '../utils/label-definitions.js';
import { AppBskyFeedDefs, AppBskyFeedGetFeedSkeleton } from '@atcute/bluesky';
import { Did, ResourceUri, type Nsid } from '@atcute/lexicons';
import type { DidDocument } from '@atcute/identity';

import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';

import {
    CompositeDidDocumentResolver,
    PlcDidDocumentResolver,
    WebDidDocumentResolver,
} from '@atcute/identity-resolver';
import { DbProvider } from '../utils/db-provider.ts';
import { Hono } from 'hono';

const didDocResolver = new CompositeDidDocumentResolver({
    methods: {
        plc: new PlcDidDocumentResolver(),
        web: new WebDidDocumentResolver(),
    },
});

const SERVICE_DID = `did:web:${FEEDS_DOMAIN}` as Did;
const jwtVerifier = new ServiceJwtVerifier({
    serviceDid: SERVICE_DID,
    resolver: didDocResolver,
});

const requireAuth = async (request: Request, lxm: Nsid): Promise<VerifiedJwt> => {
    const auth = request.headers.get('authorization');
    if (auth === null) {
        throw new AuthRequiredError({ description: `missing authorization header` });
    }
    if (!auth.startsWith('Bearer ')) {
        throw new AuthRequiredError({ description: `invalid authorization scheme` });
    }

    const jwtString = auth.slice('Bearer '.length).trim();

    const result = await jwtVerifier.verify(jwtString, { lxm });
    if (!result.ok) {
        throw new AuthRequiredError(result.error);
    }

    return result.value;
};

export default function (router: XRPCRouter, labelerDb: DbProvider) {
    router.addQuery(AppBskyFeedGetFeedSkeleton.mainSchema, {
        async handler({ params: { feed, limit, cursor }, request }) {
            await requireAuth(request, 'app.bsky.feed.getFeedSkeleton');

            if (!feed.startsWith('at://')) {
                throw new InvalidRequestError({
                    error: 'InvalidFeed',
                    description: `invalid feed`,
                });
            }

            const aturi_parts = feed.slice('at://'.length).split('/');
            if (aturi_parts.length != 3) {
                throw new InvalidRequestError({
                    error: 'InvalidFeed',
                    description: `feed must be a valid AT URI`,
                });
            }

            const [feed_did, feed_collection, feed_name] = aturi_parts;
            if (feed_collection != 'app.bsky.feed.generator') {
                throw new InvalidRequestError({
                    error: 'InvalidFeed',
                    description: `feed must reference a feed generator record`,
                });
            }

            // XXX: I think it would technically be valid for feed_did to be a handle here
            //if (feed_did != FEED_PUBLISHER_DID):
            //	return res.code(404).send("we don't host any feeds from that publisher")

            limit ??= 50;
            const cursorN = cursor ? Number(cursor) : 0;

            if (limit < 1) limit = 1;
            else if (limit > 100) limit = 100;

            if (!(feed_name in labelDefinitions)) {
                throw new InvalidRequestError({
                    error: 'InvalidFeed',
                    description: `feed does not exist`,
                });
            }

            const queryResult = await labelerDb.queryLabels(feed_name, isNaN(cursorN) ? 0 : cursorN, limit);

            return json({
                feed: queryResult.map(
                    (e) => ({ post: e.uri as ResourceUri }) satisfies AppBskyFeedDefs.SkeletonFeedPost,
                ),

                ...(queryResult.length > 0 ? { cursor: String(Math.max(...queryResult.map((e) => e.id))) } : {}),
            });
        },
    });
}

export function useDidWeb(hono: Hono) {
    hono.get('/.well-known/did.json', async (c) => {
        c.status(200);
        c.json({
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: `did:web:${FEEDS_DOMAIN}`,
            service: [
                {
                    id: '#bsky_fg',
                    type: 'BskyFeedGenerator',
                    serviceEndpoint: `https://${FEEDS_DOMAIN}`,
                },
            ],
        } satisfies DidDocument & { '@context': [string] });
    });
}
