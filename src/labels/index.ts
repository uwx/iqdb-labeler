import { createReadStream } from 'node:fs';
import readline from 'node:readline/promises';
import { BQTag, BQTagAlias, BQTagImplication, BQWikiPage } from './danbooru-query.js';
import { db } from '../lmdb.js';
import logger from '../logger.js';
import { alphabetToString, alphabetParseInt  } from '../utils/ints.js';
import { ComAtprotoLabelDefs } from '@atcute/client/lexicons';

export const enum TagCategory {
    General = 0,
    Artist = 1,
    Copyright = 3,
    Character = 4,
    Meta = 5,
}

export interface Tag {
    id: number;
    name?: string;
    words: string[];
    isDeprecated?: boolean;
    updatedAt?: Date;
    createdAt?: Date;
    category?: TagCategory;
    postCount?: number;
    aliases: {
        id: number;
        antecedentName: string;
    }[];
    impliedBy: {
        id: number;
        antecedentName: string;
    }[];
    implies: {
        id: number;
        consequentName: string;
    }[];

    wikiPageId?: number;
}

export interface WikiPage {
    id: number;

    title?: string;
    body?: string;

    otherNames: string[];

    isDeleted?: boolean;
    isLocked?: boolean;

    updatedAt?: Date;
    createdAt?: Date;
}

export interface TagImplication {
    id: number;

    forumPostId?: number;
    forumTopicId?: number;
    approverId?: number;
    creatorId?: number;

    updatedAt?: Date;
    createdAt?: Date;

    status?: string;
    reason?: string;

    antecedentName?: string;
    consequentName?: string;
}

export interface TagAlias {
    id: number;

    forumPostId?: string;
    forumTopicId?: number;
    approverId?: string;
    creatorId?: number;

    updatedAt?: Date;
    createdAt?: Date;

    status?: string;
    reason?: string;

    antecedentName?: string;
    consequentName?: string;
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

export const tags = db.table<number, Tag>('tags', 'uint32');
export const tagsByName = db.table<string, number>('tag-by-name');
export const tagsByNameOrAlias = db.table<string, number>('tag-by-alias');

export const tagAliases = db.table<number, TagAlias>('aliases', 'uint32');

export const wikiPages = db.table<number, WikiPage>('wiki-pages', 'uint32');
export const wikiPagesByTitle = db.table<string, number>('wiki-page-by-name');

export async function injectDanbooruTags() {
    logger.info('clearing tags db');
    await tags.clearAsync();
    await tagsByName.clearAsync();
    await tagsByNameOrAlias.clearAsync();
    await tagAliases.clearAsync();
    await wikiPages.clearAsync();
    await wikiPagesByTitle.clearAsync();

    logger.info('injecting tags');
    await db.transaction(async () => {
        for await (const tag of readJsonLines<BQTag>('./danbooru-data/tags.jsonl')) {
            // console.log('tag', tag.id);
            tags.put(tag.id, {
                id: tag.id,

                name: tag.name,
                words: tag.words,

                isDeprecated: tag.is_deprecated,

                updatedAt: tag.updated_at?.value ? new Date(tag.updated_at?.value) : undefined,
                createdAt: tag.created_at?.value ? new Date(tag.created_at?.value) : undefined,

                category: tag.category,
                postCount: tag.post_count,

                aliases: [],
                impliedBy: [],
                implies: [],
            });

            if (tag.name && tag.name.length < 500) {
                try {
                    tagsByName.put(tag.name, tag.id);
                    tagsByNameOrAlias.put(tag.name, tag.id);
                } catch (err) {
                    logger.error(`errored: ${JSON.stringify(tag)}`);
                    throw err;
                }
            }
        }
    });

    logger.info('injecting tag_aliases');
    await db.transaction(async () => {
        for await (const tagAlias of readJsonLines<BQTagAlias>('./danbooru-data/tag_aliases.jsonl')) {
            // console.log('tagAlias', tagAlias.id);
            tagAliases.put(tagAlias.id, {
                id: tagAlias.id,

                forumPostId: tagAlias.forum_post_id,
                forumTopicId: tagAlias.forum_topic_id,
                approverId: tagAlias.approver_id,
                creatorId: tagAlias.creator_id,

                updatedAt: tagAlias.updated_at?.value ? new Date(tagAlias.updated_at?.value) : undefined,
                createdAt: tagAlias.created_at?.value ? new Date(tagAlias.created_at?.value) : undefined,

                status: tagAlias.status,
                reason: tagAlias.reason,

                antecedentName: tagAlias.antecedent_name,
                consequentName: tagAlias.consequent_name,
            });

            if (tagAlias.consequent_name && tagAlias.antecedent_name && tagAlias.status == 'active') {
                const tag = tags.get(tagsByName.get(tagAlias.consequent_name)!);

                if (tag) {
                    if (!tag.aliases.some(e => e.id == tagAlias.id)) {
                        tag.aliases.push({
                            id: tagAlias.id,
                            antecedentName: tagAlias.antecedent_name,
                        })
                        tags.put(tag.id, tag);
                    }

                    tagsByNameOrAlias.put(tagAlias.antecedent_name, tag.id);
                }
            }
        }
    });

    logger.info('injecting tag_implications');
    await db.transaction(async () => {
        for await (const tagImplication of readJsonLines<BQTagImplication>('./danbooru-data/tag_implications.jsonl')) {
            // console.log('tagImplication', tagImplication.id);
            if (tagImplication.status == 'active') {
                if (tagImplication.antecedent_name && tagImplication.consequent_name) {
                    const antecedent = tags.get(tagsByName.get(tagImplication.antecedent_name)!)!;
                    const consequent = tags.get(tagsByName.get(tagImplication.consequent_name)!)!;

                    if (!antecedent.implies.some(e => e.id == antecedent.id)) {
                        antecedent.implies.push({
                            consequentName: consequent.name!,
                            id: consequent.id,
                        });

                        tags.put(antecedent.id, antecedent);
                    }

                    if (!consequent.impliedBy.some(e => e.id == consequent.id)) {
                        consequent.impliedBy.push({
                            antecedentName: antecedent.name!,
                            id: antecedent.id,
                        });

                        tags.put(consequent.id, consequent);
                    }
                }
            }
        }
    });

    logger.info('injecting wiki_pages');
    await db.transaction(async () => {
        for await (const wikiPage of readJsonLines<BQWikiPage>('./danbooru-data/wiki_pages.jsonl')) {
            // console.log('wikiPage', wikiPage.id);
            await wikiPages.put(wikiPage.id, {
                id: wikiPage.id,

                title: wikiPage.title,
                body: wikiPage.body,

                otherNames: wikiPage.other_names ?? [],

                isDeleted: wikiPage.is_deleted,
                isLocked: wikiPage.is_locked,

                updatedAt: wikiPage.updated_at?.value ? new Date(wikiPage.updated_at?.value) : undefined,
                createdAt: wikiPage.created_at?.value ? new Date(wikiPage.created_at?.value) : undefined,
            });

            if (wikiPage.title) {
                await wikiPagesByTitle.put(wikiPage.title, wikiPage.id);

                if (!wikiPage.is_deleted) {
                    const tagId = tagsByName.get(wikiPage.title)!;

                    if (tagId) {
                        const tag = tags.get(tagId)!;
                        tag.wikiPageId = wikiPage.id;
                        await tags.put(tag.id, tag);
                    }
                }
            }
        }
    });

    logger.info('compacting db');
    console.time('compact db');
    await db.compactDb();
    console.timeEnd('compact db');
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

    for await (const tag of tags.getRange()
        .map(e => e.value)
        .filter(tag => !tag.isDeprecated && tag.postCount && tag.postCount >= 10000 && tag.category !== TagCategory.Meta && (!tag.name || !ignoredTags.has(tag.name)))
        .asArray
        .sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0))
    ) {
        logger.debug(`${i++}: ${tag.name ?? tag.id}`);

        const wikiPage = tag.wikiPageId ? wikiPages.get(tag.wikiPageId) : undefined;

        const identifier = assertLabelIdValid(getLabelIdForTag(tag)!);

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
                    name: (tag.category !== undefined && tag.category !== TagCategory.General ? `${tagCategoryNames[tag.category]}: ` : '') +
                        `${tag.name?.replace(/_/g, ' ') ?? wikiPage?.title?.replace(/_/g, ' ') ?? String(tag.id)}`,
                    description: cleanup(wikiPage?.body ?? `Images with the ${tag.name ?? wikiPage?.title ?? tag.id} tag on Danbooru.`)
                        // + (wikiPage?.otherNames?.length ? `\n\nOther names: ${wikiPage.otherNames.join(', ')}` : '')
                },
            ]
        } satisfies ComAtprotoLabelDefs.LabelValueDefinition;
    }
}

export function getLabelIdForTag(tag: Tag): string;
export function getLabelIdForTag(tag: number | string): string | undefined;
export function getLabelIdForTag(tag: number | string | Tag): string | undefined {
    function getSanitizedTagName(tag: Tag) {
        return `${alphabetToString(tag.id)}-${tag.name?.toLowerCase()?.replace(/[^a-z-]/g, '-').replace(/-{2,}/g, '-') ?? ''}`
            .slice(0, 15);
    }

    if (typeof tag === 'string') {
        const tagId = tagsByName.get(tag);
        if (tagId) {
            const tag1 = tags.get(tagId);
            if (tag1) {
                return getSanitizedTagName(tag1);
            }
        }
    } else if (typeof tag === 'number') {
        const tag1 = tags.get(tag);
        if (tag1) {
            return getSanitizedTagName(tag1);
        }
    } else {
        return getSanitizedTagName(tag);
    }
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
        .replace(/\[expand=(.+?)\]/g, '') // Use [expand=Custom title] to add a custom title:
        .replace(/\[(th|tr|td|thead|tbody|col)(\s+(align|span|colspan|rowspan)="(.+?)")*\s*\]/g, '') // optional table element attributes
        .replace(/<\/?(?:b|strong|i|em|u|s|tn|spoiler|nodtext|code|br|hr|quote|expand|table|thead|tbody|tr|col|colgroup|th|td)>/g, '')
        .replace(new RegExp('<(' + urlRegex + ')>', 'g'), '$1') // Basic link with delimiters
        .replace(new RegExp(String.raw`"([^"]*)":\[` + urlRegex + String.raw`\]`, 'g'), '$1') // Link with custom text
        .replace(new RegExp(String.raw`\[([^\]*])\]\(` + urlRegex + String.raw`\)`, 'g'), '$1') // Markdown style link
        .replace(new RegExp(String.raw`\(` + urlRegex + String.raw`\)\[([^\]*])\]`, 'g'), '$1') // Reverse markdown style link
        .replace(/<a href="(?:.*?)">(.+?)<\/a>/g, '$1') // HTML style link
        .replace(/\[url=(?:.*?)\](.+?)\[\/url\]/g, '$1') // BBCode style link with custom text
        .replace(/"(.+?)":\[\/(?:.+?)\]/g, '$1') // Link to a Danbooru page
        .replace(/"(.+?)":\[#(?:.+?)\]/g, '$1') // Link to a specific section of the current page
        .replace(/\[\[(?:.+?)\|(.*?)\]\]/g, '$1') // Link to a wiki with custom text / Link to a wiki without the qualifier
        .replace(/\[\[(.+?)(?:#.+?)?\]\]/g, '$1') // Link to a wiki / Link to a specific section of a wiki article
        .replace(/\{\{(.+?)\}\}/g, '$1') // Link to a tag search
        .replace(/\{\{(?:.+?)\|(.*?)\}\}/g, '$1') // Link to a tag search with custom text
        .replace(/^h[4-6]\.\s*/gm, '') // Headings
        .replace(/^\.\s*/gm, '') // undocumented?
    ;
            // TODO the rest... https://danbooru.donmai.us/posts?tags=help%3Adtext
}

function assertLabelIdValid(labelId: string): string {
    if (/[^a-z-]/.test(labelId)) throw new Error(`Invalid label ID: ${labelId}`);
    return labelId;
}

