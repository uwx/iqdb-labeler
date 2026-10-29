import { createReadStream } from 'node:fs';
import readline from 'node:readline/promises';
import { BQTag, BQTagAlias, BQTagImplication, BQWikiPage } from '../tools/danbooru-query.js';
import logger from '../backend/logger.js';
import { alphabetToString, alphabetParseInt } from '../utils/ints.js';
import { ComAtprotoLabelDefs } from '@atcute/atproto';
import { createDb, migrateToLatest } from '../backend/kysely/index.js';
import { DB_PATH } from '../config.js';
import { TagCategory, TagsTable } from '../backend/kysely/schema.js';
import { sql } from 'kysely';

async function* readJsonLines<T>(path: string) {
    const fileStream = createReadStream(path);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        yield JSON.parse(line) as T;
    }

    rl.close();
    fileStream.close();
}

const db = createDb(DB_PATH);

export async function injectDanbooruTags() {
    await migrateToLatest(db);

    logger.info('clearing tags db');

    // clear tables
    await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('tags').execute();
        await trx.deleteFrom('tagAliases').execute();
        await trx.deleteFrom('wikiPages').execute();
        await trx.deleteFrom('tagImplications').execute();
    });

    logger.info('injecting tags');
    await db.transaction().execute(async (trx) => {
        for await (const tag of readJsonLines<BQTag>('./danbooru-data/tags.jsonl')) {
            await trx
                .insertInto('tags')
                .values({
                    id: tag.id,
                    name: tag.name!,
                    words: JSON.stringify(tag.words),
                    isDeprecated: tag.is_deprecated ? 1 : 0,
                    updatedAt: tag.updated_at?.value ? new Date(tag.updated_at.value).toISOString() : undefined,
                    createdAt: tag.created_at?.value ? new Date(tag.created_at.value).toISOString() : undefined,
                    category: tag.category,
                    postCount: tag.post_count,
                })
                .onConflict((oc) => oc.doNothing())
                .execute();
        }
    });

    logger.info('injecting tag_aliases');
    await db.transaction().execute(async (trx) => {
        for await (const tagAlias of readJsonLines<BQTagAlias>('./danbooru-data/tag_aliases.jsonl')) {
            // console.log('tagAlias', tagAlias.id);

            await trx
                .insertInto('tagAliases')
                .values({
                    id: tagAlias.id,
                    forumPostId: tagAlias.forum_post_id,
                    forumTopicId: tagAlias.forum_topic_id,
                    approverId: tagAlias.approver_id,
                    creatorId: tagAlias.creator_id,
                    updatedAt: tagAlias.updated_at?.value
                        ? new Date(tagAlias.updated_at.value).toISOString()
                        : undefined,
                    createdAt: tagAlias.created_at?.value
                        ? new Date(tagAlias.created_at.value).toISOString()
                        : undefined,
                    status: tagAlias.status,
                    reason: tagAlias.reason,
                    antecedentName: tagAlias.antecedent_name,
                    consequentName: tagAlias.consequent_name,
                })
                .onConflict((oc) => oc.doNothing())
                .execute();
        }
    });

    logger.info('injecting tag_implications');
    await db.transaction().execute(async (trx) => {
        for await (const tagImplication of readJsonLines<BQTagImplication>('./danbooru-data/tag_implications.jsonl')) {
            // console.log('tagImplication', tagImplication.id);

            await trx
                .insertInto('tagImplications')
                .values({
                    id: tagImplication.id,
                    forumPostId: tagImplication.forum_post_id,
                    forumTopicId: tagImplication.forum_topic_id,
                    approverId: tagImplication.approver_id,
                    creatorId: tagImplication.creator_id,
                    updatedAt: tagImplication.updated_at?.value
                        ? new Date(tagImplication.updated_at.value).toISOString()
                        : undefined,
                    createdAt: tagImplication.created_at?.value
                        ? new Date(tagImplication.created_at.value).toISOString()
                        : undefined,
                    status: tagImplication.status,
                    reason: tagImplication.reason,
                    antecedentName: tagImplication.antecedent_name,
                    consequentName: tagImplication.consequent_name,
                })
                .onConflict((oc) => oc.doNothing())
                .execute();
        }
    });

    logger.info('injecting wiki_pages');
    await db.transaction().execute(async (trx) => {
        for await (const wikiPage of readJsonLines<BQWikiPage>('./danbooru-data/wiki_pages.jsonl')) {
            // console.log('wikiPage', wikiPage.id);

            await trx
                .insertInto('wikiPages')
                .values({
                    id: wikiPage.id,
                    title: wikiPage.title,
                    body: wikiPage.body,
                    otherNames: JSON.stringify(wikiPage.other_names ?? []),
                    isDeleted: wikiPage.is_deleted ? 1 : 0,
                    isLocked: wikiPage.is_locked ? 1 : 0,
                    updatedAt: wikiPage.updated_at?.value
                        ? new Date(wikiPage.updated_at.value).toISOString()
                        : undefined,
                    createdAt: wikiPage.created_at?.value
                        ? new Date(wikiPage.created_at.value).toISOString()
                        : undefined,
                })
                .onConflict((oc) => oc.doNothing())
                .execute();
        }
    });

    // logger.info('compacting db');
    console.time('compact db');
    await sql`VACUUM`.execute(db);
    console.timeEnd('compact db');
}

export async function* getLabelValueDefinitions() {
    const tagCategoryNames: Record<TagCategory, string> = {
        [TagCategory.General]: 'general',
        [TagCategory.Artist]: 'artist',
        [TagCategory.Copyright]: 'copyright',
        [TagCategory.Character]: 'character',
        [TagCategory.Meta]: 'meta',
    };

    const ignoredTags = ['banned_artist'];
    let i = 0;

    const identifiers = new Map<string, TagsTable>();

    const tags = db
        .selectFrom('tags')
        .where('isDeprecated', '=', 0)
        .where('postCount', '>=', 10000n)
        .where('category', '!=', TagCategory.Meta)
        .where((eb) => eb.or([eb('name', 'is', null), eb('name', 'not in', ignoredTags)]))
        .leftJoin('wikiPages', 'tags.name', 'wikiPages.title')
        .orderBy('postCount', 'desc')
        .select(['tags.id', 'tags.name', 'tags.category', 'wikiPages.title', 'wikiPages.body'])
        .stream();

    for await (const tag of tags) {
        logger.debug(`${i++}: ${tag.name ?? tag.id}`);

        const identifier = assertLabelIdValid(getLabelIdForTag(tag)!);

        if (identifiers.has(identifier)) {
            const otherTag = identifiers.get(identifier)!;
            throw new Error(
                `Identifier conflict: ${identifier} is used by both ${tag.name} (#${tag.id}) and ${otherTag.name} (#${otherTag.id})`,
            );
        }

        yield {
            identifier,
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            locales: [
                {
                    lang: 'en',
                    name:
                        (tag.category != null && tag.category !== TagCategory.General
                            ? `${tagCategoryNames[tag.category]}: `
                            : '') +
                        `${tag.name?.replace(/_/g, ' ') ?? tag?.title?.replace(/_/g, ' ') ?? String(tag.id)}`,
                    description: cleanup(
                        tag?.body ?? `Images with the ${tag.name ?? tag?.title ?? tag.id} tag on Danbooru.`,
                    ),
                    // + (wikiPage?.otherNames?.length ? `\n\nOther names: ${wikiPage.otherNames.join(', ')}` : '')
                },
            ],
        } satisfies ComAtprotoLabelDefs.LabelValueDefinition;
    }
}

/**
 * Converts a tag, tag ID or tag name into a formatted label identifier of max 15 characters containing only characters in the alphabet /[a-z-]/.
 * The converted string contains the tag ID encoded in a base 26 alphabet (lowercase a-z) alongside the sanitized tag name, truncating if necessary.
 *
 * @param tag
 */
export function getLabelIdForTag(tag: { id: number | bigint; name: string }): string;
export function getLabelIdForTag(tag: number | string): Promise<string | undefined>;
export function getLabelIdForTag(
    tag: number | string | { id: number | bigint; name: string },
): Promise<string | undefined> | string {
    function getSanitizedTagName(tag: { id: number | bigint; name: string }) {
        const name = `${alphabetToString(Number(tag.id))}-${
            tag.name
                ?.toLowerCase()
                ?.replace(/[^a-z-]/g, '-')
                .replace(/-{2,}/g, '-') ?? ''
        }`;

        if (name.indexOf('-') >= 14) {
            throw new Error('Sanity check failed: tag ID is too big to fit in a feed rkey');
        }

        return name.slice(0, 15);
    }

    if (typeof tag === 'string') {
        return (async () => {
            const tag1 = await db.selectFrom('tags').where('name', '=', tag).selectAll().executeTakeFirst();
            if (tag1) {
                return getSanitizedTagName(tag1);
            }
            return undefined;
        })();
    } else if (typeof tag === 'number') {
        return (async () => {
            const tag1 = await db.selectFrom('tags').where('id', '=', BigInt(tag)).selectAll().executeTakeFirst();

            if (tag1) {
                return getSanitizedTagName(tag1);
            }
        })();
    } else {
        return getSanitizedTagName(tag);
    }
}

/**
 * Parses a string in the format returned by {@link getLabelIdForTag} into a tuple of [danbooru tag number, remainder]
 * @param labelIdentifier The label identifier returned by {@link getLabelIdForTag}
 */
export function parseLabelIdentifier(labelIdentifier: string): [tag: number, snippet: string] {
    const tagIdSnippetSeparator = labelIdentifier.indexOf('-');
    if (tagIdSnippetSeparator === -1) throw new Error('Not a valid label identifier!');
    const stringifiedTagId = labelIdentifier.slice(0, tagIdSnippetSeparator);
    const snippet = labelIdentifier.slice(tagIdSnippetSeparator + 1);

    return [alphabetParseInt(stringifiedTagId), snippet];
}

function indexOfAny(str: string, ...options: string[]) {
    const idxs = options.map((e) => str.indexOf(e)).filter((e) => e > -1);
    return idxs.length == 0 ? -1 : Math.min(...idxs);
}

function cleanup(str: string): string {
    function stripToFirstHeading(str: string): string {
        const idx = indexOfAny(str, 'h4. ', 'h5. ', 'h6. ');
        if (idx == -1) return str;
        return str.slice(0, idx);
    }

    function stripToParagraphSeparator(str: string): string {
        const idx = indexOfAny(str, '\r\n\r\n', '\n\n');
        if (idx == -1) return str;
        return str.slice(0, idx);
    }

    str = stripToFirstHeading(str);
    str = removeDtext(str);
    str = stripToParagraphSeparator(str);

    return str.trim();
}

function removeDtext(str: string): string {
    const urlRegex = String.raw`https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)`; //https://stackoverflow.com/a/3809435

    return str
        .replace(
            /\[\/?(?:[bius]|tn|spoilers|nodtext|code|br|url|table|thead|tbody|tr|col|colgroup|th|td|expand|quote|hr)\]/g,
            '',
        ) // Basic formatting
        .replace(/\[expand=[^\]]+\]/g, '') // Use [expand=Custom title] to add a custom title:
        .replace(/\[(th|tr|td|thead|tbody|col)(\s+(align|span|colspan|rowspan)="[^"]*")*\s*\]/g, '') // optional table element attributes
        .replace(
            /<\/?(?:b|strong|i|em|u|s|tn|spoiler|nodtext|code|br|hr|quote|expand|table|thead|tbody|tr|col|colgroup|th|td)>/g,
            '',
        )
        .replace(new RegExp('<(' + urlRegex + ')>', 'g'), '$1') // Basic link with delimiters
        .replace(new RegExp(String.raw`"([^"]*)":\[` + urlRegex + String.raw`\]`, 'g'), '$1') // Link with custom text
        .replace(new RegExp(String.raw`\[([^\]*])\]\(` + urlRegex + String.raw`\)`, 'g'), '$1') // Markdown style link
        .replace(new RegExp(String.raw`\(` + urlRegex + String.raw`\)\[([^\]*])\]`, 'g'), '$1') // Reverse markdown style link
        .replace(/<a href=".*?">(.+?)<\/a>/g, '$1') // HTML style link
        .replace(/\[url=.*?\](.+?)\[\/url\]/g, '$1') // BBCode style link with custom text
        .replace(/"([^"]+?)":\[[\/#].+?\]/g, '$1') // Link to a Danbooru page / Link to a specific section of the current page
        .replace(/\[\[.+?\|(.*?)\]\]/g, '$1') // Link to a wiki with custom text / Link to a wiki without the qualifier
        .replace(/\[\[([^\]]+?)(?:#.+?)?\]\]/g, '$1') // Link to a wiki / Link to a specific section of a wiki article
        .replace(/\{\{([^\}]+?)\}\}/g, '$1') // Link to a tag search
        .replace(/\{\{[^\|\}]+?\|(.*?)\}\}/g, '$1') // Link to a tag search with custom text
        .replace(/^h[4-6]\.\s*/gm, '') // Headings
        .replace(/^\.\s*/gm, ''); // undocumented?
    // TODO the rest... https://danbooru.donmai.us/posts?tags=help%3Adtext
}

function assertLabelIdValid(labelId: string): string {
    if (/[^a-z-]/.test(labelId)) throw new Error(`Invalid label ID: ${labelId}`);
    return labelId;
}
