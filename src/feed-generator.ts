import fastify, { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify';
import { XRPCError } from '@atcute/client';
import { verifyJwt } from '#skyware/labeler/util/crypto.js';
import { DidDocument } from '@atcute/client/utils/did';
import { FEEDS_DOMAIN } from './config.js';
import { LabelerServer } from '#skyware/labeler/index.js';
import { labelDefinitions } from './utils/label-definitions.js';
import { AppBskyFeedDefs, AppBskyFeedGetFeedSkeleton } from '@atcute/client/lexicons';
import fastifyPlugin from 'fastify-plugin';

async function parseAuthHeaderDid(req: FastifyRequest, ownDid: string): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new XRPCError(401, {
            kind: "AuthRequired",
            description: "Authorization header is required",
        });
    }

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) {
        throw new XRPCError(400, {
            kind: "MissingJwt",
            description: "Missing or invalid bearer token",
        });
    }

    const nsid = (req.originalUrl || req.url || "").split("?")[0].replace("/xrpc/", "").replace(
        /\/$/,
        "",
    );

    const payload = await verifyJwt(token, ownDid, nsid);

    return payload.iss;
}

export default fastifyPlugin((app: FastifyInstance, { labelerServer }: { labelerServer: LabelerServer }, done) => {
    app.get('/xrpc/app.bsky.feed.getFeedSkeleton', async (req: FastifyRequest<{ Querystring: AppBskyFeedGetFeedSkeleton.Params }>, res) => {
        const requesterDid = await parseAuthHeaderDid(req, `did:web:${FEEDS_DOMAIN}`);

        if (!req.query.feed) {
            await res.code(500).send("no feed specified");
            return;
        }

        const feed = req.query["feed"]
        if (!feed.startsWith("at://")) {
            await res.code(500).send("feed must be a valid AT URI")
            return;
        }

        const aturi_parts = feed.slice("at://".length).split("/")
        if (aturi_parts.length != 3) {
            await res.code(500).send("feed must be a valid AT URI")
            return;
        }

        const [feed_did, feed_collection, feed_name] = aturi_parts;
        if (feed_collection != "app.bsky.feed.generator") {
            await res.code(500).send("feed must reference a feed generator record")
            return;
        }

        // XXX: I think it would technically be valid for feed_did to be a handle here
        //if (feed_did != FEED_PUBLISHER_DID):
        //	return res.code(404).send("we don't host any feeds from that publisher")

        let limit = req.query.limit ?? 50;
        const cursor = req.query.cursor ? Number(req.query.cursor) : 0;

        if (limit < 1)
            limit = 1;
        else if (limit > 100)
            limit = 100;

        if (!(feed_name in labelDefinitions)) {
            await res.code(404).send("feed does not exist");
            return;
        }

        const queryResult = await labelerServer.queryLabels(feed_name, isNaN(cursor) ? 0 : cursor, limit);

        const obj: AppBskyFeedGetFeedSkeleton.Output = {
            feed: queryResult.map(e => ({ post: e.uri } satisfies AppBskyFeedDefs.SkeletonFeedPost)),
        };

        if (queryResult.length > 0) {
            obj.cursor = ''+Math.max(...queryResult.map(e => e.id));
        }

        await res.code(200).send(obj);
    });

    app.get('/.well-known/did.json', async (req, res) => {
        await res.code(200).send({
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

    done();
});
