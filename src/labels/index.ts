import { createReadStream } from 'node:fs';
import readline from 'node:readline/promises';
import { BQTag, BQTagAlias, BQTagImplication, BQWikiPage } from './danbooru-query.js';
import logger from '../backend/logger.js';
import { alphabetToString, alphabetParseInt  } from '../utils/ints.js';
import { ComAtprotoLabelDefs } from '@atcute/client/lexicons';
import { Tag, TagAlias, TagImplication, WikiPage } from '../backend/db/types.js';
import { db } from '../backend/db.js';
import { Insertable, InsertType } from 'kysely';

export const enum TagCategory {
    General = 0,
    Artist = 1,
    Copyright = 3,
    Character = 4,
    Meta = 5,
}

async function* readJsonLines<T>(path: string) {
    const fileStream = createReadStream(path);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        yield JSON.parse(line) as T;
    }

    rl.close();
    fileStream.close();
}

export async function getTag(idOrNameOrAlias: number | string): Promise<Tag | undefined> {
    if (typeof idOrNameOrAlias === 'number') {
        return await db
            .selectFrom('Tag')
            .selectAll()
            .where('id', '=', idOrNameOrAlias)
            .executeTakeFirst();
    }
    return await db
        .selectFrom('Tag')
        .selectAll()
        .where('name', '=', idOrNameOrAlias)
        .executeTakeFirst()
        ?? await db
            .selectFrom(['TagAlias', 'Tag'])
            .where('TagAlias.antecedentName', '=', idOrNameOrAlias)
            .whereRef('TagAlias.consequentName', '=', 'Tag.name')
            .selectAll('Tag')
            .executeTakeFirst();
}

export async function injectDanbooruTags() {

    logger.info('injecting tags');
    await db.transaction().execute(async trx => {
        for await (const tag of readJsonLines<BQTag>('./danbooru-data/tags.jsonl')) {
            // console.log('tag', tag.id);
            const value: Insertable<Tag> = {
                id: tag.id,

                name: tag.name,
                words: JSON.stringify(tag.words),

                isDeprecated: tag.is_deprecated ? 1 : 0,

                updatedAt: tag.updated_at?.value ? new Date(tag.updated_at?.value).getTime() : null,
                createdAt: tag.created_at?.value ? new Date(tag.created_at?.value).getTime() : null,

                category: tag.category,
                postCount: tag.post_count,
            };
            await trx
                .insertInto('Tag')
                .values(value)
                .onConflict(oc => oc
                    .column('id')
                    .doUpdateSet(value)
                ).execute();
        }
    })

    logger.info('injecting tag_aliases');
    await db.transaction().execute(async trx => {
        for await (const tagAlias of readJsonLines<BQTagAlias>('./danbooru-data/tag_aliases.jsonl')) {
            // console.log('tagAlias', tagAlias.id);

            const value: Insertable<TagAlias> = {
                id: tagAlias.id,

                forumPostId: Number(tagAlias.forum_post_id),
                forumTopicId: tagAlias.forum_topic_id,
                approverId: Number(tagAlias.approver_id),
                creatorId: tagAlias.creator_id,

                updatedAt: tagAlias.updated_at?.value ? new Date(tagAlias.updated_at?.value).getTime() : null,
                createdAt: tagAlias.created_at?.value ? new Date(tagAlias.created_at?.value).getTime() : null,

                status: tagAlias.status,
                reason: tagAlias.reason,

                antecedentName: tagAlias.antecedent_name,
                consequentName: tagAlias.consequent_name,
            };
            await trx
                .insertInto('TagAlias')
                .values(value)
                .onConflict(oc => oc
                    .column('id')
                    .doUpdateSet(value)
                ).execute();
        }
    });

    logger.info('injecting tag_implications');
    await db.transaction().execute(async trx => {
        for await (const tagImplication of readJsonLines<BQTagImplication>('./danbooru-data/tag_implications.jsonl')) {
            // console.log('tagImplication', tagImplication.id);
            if (tagImplication.status == 'active') {
                const value: Insertable<TagImplication> = {
                    id: tagImplication.id,
    
                    forumPostId: tagImplication.forum_post_id,
                    forumTopicId: tagImplication.forum_topic_id,
                    approverId: tagImplication.approver_id,
                    creatorId: tagImplication.creator_id,
    
                    updatedAt: tagImplication.updated_at?.value ? new Date(tagImplication.updated_at?.value).getTime() : null,
                    createdAt: tagImplication.created_at?.value ? new Date(tagImplication.created_at?.value).getTime() : null,
    
                    status: tagImplication.status,
                    reason: tagImplication.reason,
    
                    antecedentName: tagImplication.antecedent_name,
                    consequentName: tagImplication.consequent_name,
                };
                await trx
                    .insertInto('TagImplication')
                    .values(value)
                    .onConflict(oc => oc
                        .column('id')
                        .doUpdateSet(value)
                    ).execute();
            }
        }
    });

    logger.info('injecting wiki_pages');
    await db.transaction().execute(async trx => {
        for await (const wikiPage of readJsonLines<BQWikiPage>('./danbooru-data/wiki_pages.jsonl')) {
            // console.log('wikiPage', wikiPage.id);
            const value: Insertable<WikiPage> = {
                id: wikiPage.id,

                title: wikiPage.title,
                body: wikiPage.body,

                otherNames: JSON.stringify(wikiPage.other_names ?? []),

                isDeleted: wikiPage.is_deleted ? 1 : 0,
                isLocked: wikiPage.is_locked ? 1 : 0,

                updatedAt: wikiPage.updated_at?.value ? new Date(wikiPage.updated_at?.value).getTime() : null,
                createdAt: wikiPage.created_at?.value ? new Date(wikiPage.created_at?.value).getTime() : null,
            };

            await trx
                .insertInto('WikiPage')
                .values(value)
                .onConflict(oc => oc
                    .column('id')
                    .doUpdateSet(value)
                ).execute();
        }
    });

    // logger.info('compacting db');
    // console.time('compact db');
    // await db.compactDb();
    // console.timeEnd('compact db');
}

export async function *getLabelValueDefinitions() {
    const tagCategoryNames: Record<TagCategory, string> = {
        [TagCategory.General]: 'general',
        [TagCategory.Artist]: 'artist',
        [TagCategory.Copyright]: 'copyright',
        [TagCategory.Character]: 'character',
        [TagCategory.Meta]: 'meta',
    };

    const ignoredTags = new Set<string>(['banned_artist']);
    let i = 0;

    const identifiers = new Map<string, Tag>();

    for (const tag of await db.selectFrom('Tag')
        .selectAll()
        .where(eb => eb.and([
            eb('isDeprecated', '=', 0),
            eb('postCount', '>=', 10000),
            eb('category', '!=', TagCategory.Meta),
            eb('name', 'not in', [...ignoredTags])
        ]))
        .execute()
        .then(e => e.sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0)))
    ) {
        logger.debug(`${i++}: ${tag.name ?? tag.id}`);

        const wikiPage = await db.selectFrom('WikiPage').selectAll().where('title', '=', tag.name).executeTakeFirst();

        const identifier = assertLabelIdValid(await getLabelIdForTag(tag)!);

        if (identifiers.has(identifier)) {
            const otherTag = identifiers.get(identifier)!;
            throw new Error(`Identifier conflict: ${identifier} is used by both ${tag.name} (#${tag.id}) and ${otherTag.name} (#${otherTag.id})`)
        }

        yield {
            identifier,
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            locales: [
                {
                    lang: 'en',
                    name: (tag.category !== undefined && tag.category !== TagCategory.General ? `${tagCategoryNames[tag.category as TagCategory ?? TagCategory.General]}: ` : '') +
                        `${tag.name?.replace(/_/g, ' ') ?? wikiPage?.title?.replace(/_/g, ' ') ?? String(tag.id)}`,
                    description: cleanup(wikiPage?.body ?? `Images with the ${tag.name ?? wikiPage?.title ?? tag.id} tag on Danbooru.`)
                        // + (wikiPage?.otherNames?.length ? `\n\nOther names: ${wikiPage.otherNames.join(', ')}` : '')
                },
            ]
        } satisfies ComAtprotoLabelDefs.LabelValueDefinition;
    }
}

/**
 * Converts a tag, tag ID or tag name into a formatted label identifier of max 15 characters containing only characters in the alphabet /[a-z-]/.
 * The converted string contains the tag ID encoded in a base 26 alphabet (lowercase a-z) alongside the sanitized tag name, truncating if necessary.
 *
 * @param tag
 */
export async function getLabelIdForTag(tag: Tag): Promise<string>;
export async function getLabelIdForTag(tag: number | string): Promise<string | undefined>;
export async function getLabelIdForTag(tag: number | string | Tag): Promise<string | undefined> {
    if (typeof tag === 'string') {
        const theTag = await db
            .selectFrom('Tag')
            .select(['id', 'name'])
            .where('name', '=', tag)
            .executeTakeFirst();

        if (theTag) {
            return getSanitizedTagName(theTag);
        }
    } else if (typeof tag === 'number') {
        const theTag = await db
            .selectFrom('Tag')
            .select(['id', 'name'])
            .where('id', '=', tag)
            .executeTakeFirst();

        if (theTag) {
            return getSanitizedTagName(theTag);
        }
    } else {
        return getSanitizedTagName(tag);
    }
}

export function getSanitizedTagName(tag: { id: number, name: string | null }) {
    const name = `${alphabetToString(tag.id)}-${tag.name?.toLowerCase()?.replace(/[^a-z-]/g, '-').replace(/-{2,}/g, '-') ?? ''}`;

    if (name.indexOf('-') >= 14) {
        throw new Error('Sanity check failed: tag ID is too big to fit in a feed rkey');
    }

    return name.slice(0, 15);
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
    const idxs = options.map(e => str.indexOf(e)).filter(e => e > -1);
    return idxs.length == 0 ? -1 : Math.min(...idxs);
}

function cleanup(str: string): string {
    function stripToFirstHeading(str: string): string {
        const idx = indexOfAny(str, 'h4. ', 'h5. ', 'h6. ');
        if (idx == -1) return str;
        return str.slice(0, idx);
    }

    function stripToParagraphSeparator(str: string): string {
        const idx = indexOfAny(str, '\r\n\r\n', '\n\n')
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
        .replace(/\[\/?(?:[bius]|tn|spoilers|nodtext|code|br|url|table|thead|tbody|tr|col|colgroup|th|td|expand|quote|hr)\]/g, '') // Basic formatting
        .replace(/\[expand=[^\]]+\]/g, '') // Use [expand=Custom title] to add a custom title:
        .replace(/\[(th|tr|td|thead|tbody|col)(\s+(align|span|colspan|rowspan)="[^"]*")*\s*\]/g, '') // optional table element attributes
        .replace(/<\/?(?:b|strong|i|em|u|s|tn|spoiler|nodtext|code|br|hr|quote|expand|table|thead|tbody|tr|col|colgroup|th|td)>/g, '')
        .replace(new RegExp('<(' + urlRegex + ')>', 'g'), '$1') // Basic link with delimiters
        .replace(new RegExp(String.raw`"([^"]*)":\[` + urlRegex + String.raw`\]`, 'g'), '$1') // Link with custom text
        .replace(new RegExp(String.raw`\[([^\]*])\]\(` + urlRegex + String.raw`\)`, 'g'), '$1') // Markdown style link
        .replace(new RegExp(String.raw`\(` + urlRegex + String.raw`\)\[([^\]*])\]`, 'g'), '$1') // Reverse markdown style link
        .replace(/<a href=".*?">(.+?)<\/a>/g, '$1') // HTML style link
        .replace(/\[url=.*?\](.+?)\[\/url\]/g, '$1') // BBCode style link with custom text
        .replace(/"([^"]+?)":\[[/#].+?\]/g, '$1') // Link to a Danbooru page / Link to a specific section of the current page
        .replace(/\[\[.+?\|(.*?)\]\]/g, '$1') // Link to a wiki with custom text / Link to a wiki without the qualifier
        .replace(/\[\[([^\]]+?)(?:#.+?)?\]\]/g, '$1') // Link to a wiki / Link to a specific section of a wiki article
        .replace(/\{\{([^}]+?)\}\}/g, '$1') // Link to a tag search
        .replace(/\{\{[^|}]+?\|(.*?)\}\}/g, '$1') // Link to a tag search with custom text
        .replace(/^h[4-6]\.\s*/gm, '') // Headings
        .replace(/^\.\s*/gm, '') // undocumented?
    ;
            // TODO the rest... https://danbooru.donmai.us/posts?tags=help%3Adtext
}

function assertLabelIdValid(labelId: string): string {
    if (/[^a-z-]/.test(labelId)) throw new Error(`Invalid label ID: ${labelId}`);
    return labelId;
}

