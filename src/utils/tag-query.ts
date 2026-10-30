import { getLabelIdForTag } from '../labels/index.ts';
import { createDb } from '../backend/kysely/index.js';
import { DB_PATH } from '../config.js';

const db = createDb(DB_PATH);

const SUPPORTED = 'space-separated tags (all must match), -tag to exclude, tag* prefix wildcard, order:recent';

export class UnsupportedQueryError extends Error {}

export interface TagQuery {
    include: string[];
    exclude: string[];
    prefix: string[];
    order: 'recent';
}

function normalise(term: string): string {
    return term.toLowerCase().replace(/ /g, '_');
}

export function parseTagQuery(input: string, maxTags = 10): TagQuery {
    const query: TagQuery = { include: [], exclude: [], prefix: [], order: 'recent' };
    // whitespace separates tags, as in Danbooru; multi-word tags use underscores
    const terms = input.trim().split(/\s+/).filter(Boolean);

    for (const raw of terms) {
        if (raw === 'or' || raw.startsWith('~') || raw.includes('(') || raw.includes(')')) {
            throw new UnsupportedQueryError(`"${raw}" is not supported. Supported: ${SUPPORTED}`);
        }

        const colon = raw.indexOf(':');
        if (colon !== -1) {
            const key = raw.slice(0, colon).toLowerCase();
            if (key !== 'order') {
                throw new UnsupportedQueryError(`"${key}:" is not supported. Supported: ${SUPPORTED}`);
            }
            if (normalise(raw.slice(colon + 1)) !== 'recent') {
                throw new UnsupportedQueryError(`Only order:recent is supported. Supported: ${SUPPORTED}`);
            }
            continue;
        }

        const negated = raw.startsWith('-') && raw.length > 1;
        const term = negated ? raw.slice(1) : raw;

        if (term.endsWith('*')) {
            const prefix = normalise(term.slice(0, -1));
            if (!prefix) throw new UnsupportedQueryError(`"${raw}": wildcard needs a prefix`);
            (negated ? query.exclude : query.prefix).push(prefix);
        } else {
            (negated ? query.exclude : query.include).push(normalise(term));
        }
    }

    if (query.include.length + query.exclude.length + query.prefix.length > maxTags) {
        throw new UnsupportedQueryError(`at most ${maxTags} tags per query`);
    }

    return query;
}

/**
 * Resolve a tag name (or alias) to its label val. Returns null when the tag is
 * unknown — the caller decides whether that is an empty result or an error.
 */
export async function resolveVal(name: string): Promise<string | null> {
    const row = await db
        .selectFrom('tags')
        .select(['id', 'name'])
        // mirrors getTagIdByNameOrAlias: the name may be an alias of the real tag
        .where((eb) =>
            eb.or([
                eb('name', '=', name),
                eb(
                    'name',
                    '=',
                    eb.selectFrom('tagAliases').select('consequentName').where('antecedentName', '=', name).limit(1),
                ),
            ]),
        )
        .executeTakeFirst();

    return row?.name ? getLabelIdForTag({ id: row.id, name: row.name }) : null;
}

/** Resolve a prefix to every label val whose tag name starts with it. */
export async function resolvePrefix(prefix: string): Promise<string[]> {
    const rows = await db
        .selectFrom('tags')
        .select(['id', 'name'])
        .where('name', 'like', prefix + '%')
        .where('isDeprecated', '=', 0)
        .where('postCount', '>=', 10000n)
        .limit(200)
        .execute();

    return rows.filter((row) => row.name).map((row) => getLabelIdForTag({ id: row.id, name: row.name! }));
}

/**
 * How many labels each val has, so the caller can drive the scan off the rarest
 * include term. Unknown vals get -1 and sort first, but are dropped by the caller.
 */
async function labelCount(val: string): Promise<number> {
    const row = await db
        .selectFrom('labels')
        .select((eb) => eb.fn.countAll().as('n'))
        .where('val', '=', val)
        .executeTakeFirst();
    return Number(row?.n ?? 0);
}

/** Turn a parsed query into label vals, dropping tags with no labels. */
export async function resolveQuery(query: TagQuery): Promise<{
    include: string[];
    exclude: string[];
    prefix: string[][];
    unknown: string[];
}> {
    const unknown: string[] = [];
    const include: string[] = [];
    const exclude: string[] = [];
    const prefix: string[][] = [];

    for (const name of query.include) {
        const val = await resolveVal(name);
        if (val === null) unknown.push(name);
        else include.push(val);
    }
    for (const name of query.exclude) {
        const val = await resolveVal(name);
        if (val !== null) exclude.push(val);
    }
    for (const name of query.prefix) {
        const vals = await resolvePrefix(name);
        if (vals.length === 0) unknown.push(name + '*');
        else prefix.push(vals);
    }

    // drive the scan from the rarest include val
    const counted = await Promise.all(include.map(async (val) => ({ val, n: await labelCount(val) })));
    counted.sort((a, b) => a.n - b.n);

    return { include: counted.map((c) => c.val), exclude, prefix, unknown };
}
