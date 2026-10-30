import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { SEARCH_MAX_TAGS, SEARCH_SCAN_CAP } from '../config.js';
import { parseTagQuery, resolveQuery, UnsupportedQueryError } from '../utils/tag-query.ts';
import { SqliteDbProvider } from '../utils/nodesqlite-db-provider.ts';

const MAX_LIMIT = 200;
// every candidate in the window costs a point lookup (~50us), so a deep offset is
// linear DB work per request on a public endpoint
const MAX_OFFSET = SEARCH_SCAN_CAP * 5;

export default function plugin(hono: Hono, labelerDb: SqliteDbProvider) {
    hono.use('/search', cors());

    hono.get('/search', async (c) => {
        const tags = c.req.query('tags') ?? '';
        const limit = Math.min(MAX_LIMIT, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));
        const requestedOffset = Number(c.req.query('offset') ?? 0) || 0;
        if (requestedOffset > MAX_OFFSET) {
            return c.json({ error: 'BadOffset', message: `offset must be at most ${MAX_OFFSET}` }, 400);
        }
        const offset = Math.max(0, requestedOffset);

        let query;
        try {
            query = parseTagQuery(tags, SEARCH_MAX_TAGS);
        } catch (error) {
            if (error instanceof UnsupportedQueryError) {
                return c.json({ error: 'UnsupportedQuery', message: error.message }, 400);
            }
            throw error;
        }

        const resolved = await resolveQuery(query);
        if (resolved.unknown.length) {
            return c.json({ error: 'UnknownTag', message: `unknown or unlabeled: ${resolved.unknown.join(', ')}` }, 400);
        }
        if (resolved.include.length === 0 && resolved.prefix.length === 0) {
            return c.json({ error: 'NoTags', message: 'at least one included tag is required' }, 400);
        }

        const { posts, truncated } = await labelerDb.searchLabelsByTags(resolved, offset, limit, SEARCH_SCAN_CAP);

        return c.json({
            posts,
            ...(posts.length === limit ? { nextOffset: offset + posts.length } : {}),
            ...(truncated ? { truncated: true } : {}),
        });
    });
}
