/* eslint-disable @typescript-eslint/no-explicit-any */
import { GetOptions, Level } from 'level';
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline/promises';
import { BQTag, BQTagAlias, BQTagImplication, BQWikiPage } from './danbooru-query.js';
import { Packr, pack, unpack } from 'msgpackr';
import { type ComAtprotoLabelDefs } from '@atproto/api';
import { arrayFromAsync } from '../utils.js';

const packr = new Packr({
	getStructures() {
		// storing our data in file (but we could also store in a db or key-value store)
		return existsSync('msgpackr-shared-structures.mp') && unpack(readFileSync('msgpackr-shared-structures.mp')) || [];
	},
	saveStructures(structures) {
		writeFileSync('msgpackr-shared-structures.mp', pack(structures));
	},
    maxSharedStructures: 256,
});

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

const db = new Level('labels.ldb');
interface IEncoding<TIn, TFormat, TOut> {
    /**
     * Encode data.
     */
    encode: (data: TIn) => TFormat

    /**
     * Decode data.
     */
    decode: (data: TFormat) => TOut

    /**
     * Unique name.
     */
    name: string

    /**
     * The name of the (lower-level) encoding used by the return value of
     * {@link encode}. One of 'buffer', 'view', 'utf8'.
     */
    format: 'buffer' | 'view' | 'utf8'
}

class Int32Encoding implements IEncoding<number, Uint8Array, number> {
    static instance = new Int32Encoding();

    encode = (data: number): Uint8Array => {
        const arr = new Int32Array(1);
        arr[0] = data;
        return new Uint8Array(arr.buffer);
    }

    decode = (data: Uint8Array): number => {
        const arr = new Int32Array(data.buffer);
        return arr[0];
    }

    readonly name = 'int32';
    readonly format = 'buffer' as const;
}

class PackrEncoding implements IEncoding<any, Uint8Array, any> {
    static instance = new PackrEncoding();

    encode = (data: any): Uint8Array => {
        return packr.encode(data);
    }

    decode = (data: Uint8Array): any => {
        return packr.decode(data);
    }

    readonly name = 'packr';
    readonly format = 'buffer' as const;
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

import { AbstractLevel } from 'abstract-level';

export async function getOrDefault<F, K, V>(level: AbstractLevel<F, K, V>, key: K, options: GetOptions<K, V> = {}): Promise<V | undefined> {
    try {
        return await level.get<K, V>(key, options);
    } catch (err) {
        if (err.code !== 'LEVEL_NOT_FOUND') {
            throw err;
        }
        return undefined;
    }
}

export const tags = db.sublevel<number, Tag>('tags', { keyEncoding: Int32Encoding.instance, valueEncoding: PackrEncoding.instance });
export const tagsByName = db.sublevel('tag-by-name', { keyEncoding: db.keyEncoding('utf8'), valueEncoding: Int32Encoding.instance });
export const tagsByNameOrAlias = db.sublevel('tag-by-alias', { keyEncoding: db.keyEncoding('utf8'), valueEncoding: Int32Encoding.instance });

export const tagAliases = db.sublevel<number, TagAlias>('aliases', { keyEncoding: Int32Encoding.instance, valueEncoding: PackrEncoding.instance });

export const wikiPages = db.sublevel<number, WikiPage>('wiki-pages', { keyEncoding: Int32Encoding.instance, valueEncoding: PackrEncoding.instance });
export const wikiPagesByTitle = db.sublevel<string, number>('wiki-page-by-name', { keyEncoding: db.keyEncoding('utf8'), valueEncoding: Int32Encoding.instance });

export async function injectDanbooruTags() {
    for await (const tag of readJsonLines<BQTag>('./danbooru-data/tags.jsonl')) {
        await tags.put(tag.id, {
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

        if (tag.name) {
            await tagsByName.put(tag.name, tag.id);
            await tagsByNameOrAlias.put(tag.name, tag.id);
        }
    }

    for await (const tagAlias of readJsonLines<BQTagAlias>('./danbooru-data/tag_aliases.jsonl')) {
        await tagAliases.put(tagAlias.id, {
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
            const tag = await tags.get(await tagsByName.get(tagAlias.consequent_name))
            if (!tag.aliases.some(e => e.id == tagAlias.id)) {
                tag.aliases.push({
                    id: tagAlias.id,
                    antecedentName: tagAlias.antecedent_name,
                })
                await tags.put(tag.id, tag);
            }

            await tagsByNameOrAlias.put(tagAlias.antecedent_name, tag.id);
        }
    }

    for await (const tagImplication of readJsonLines<BQTagImplication>('./danbooru-data/tag_aliases.jsonl')) {
        if (tagImplication.status == 'active') {
            if (tagImplication.antecedent_name && tagImplication.consequent_name) {
                const antecedent = await tags.get(await tagsByName.get(tagImplication.antecedent_name));
                const consequent = await tags.get(await tagsByName.get(tagImplication.consequent_name));

                if (!antecedent.implies.some(e => e.id == antecedent.id)) {
                    antecedent.implies.push({
                        consequentName: consequent.name!,
                        id: consequent.id,
                    });

                    await tags.put(antecedent.id, antecedent);
                }

                if (!consequent.impliedBy.some(e => e.id == consequent.id)) {
                    consequent.impliedBy.push({
                        antecedentName: antecedent.name!,
                        id: antecedent.id,
                    });

                    await tags.put(consequent.id, consequent);
                }
            }
        }
    }

    for await (const wikiPage of readJsonLines<BQWikiPage>('./danbooru-data/wiki_pages.jsonl')) {
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
                const tagId = await getOrDefault(tagsByName, wikiPage.title);

                if (tagId) {
                    const tag = await tags.get(tagId);
                    tag.wikiPageId = wikiPage.id;
                    await tags.put(tag.id, tag);
                }
            }
        }
    }
}

export async function *getLabelValueDefinitions() {
    const tagCategoryNames: Record<TagCategory, string> = {
        [TagCategory.General]: 'general',
        [TagCategory.Artist]: 'artist',
        [TagCategory.Copyright]: 'copyright',
        [TagCategory.Character]: 'character',
        [TagCategory.Meta]: 'meta',
    };

    for await (const tag of (await arrayFromAsync(tags.values())).sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0))) {
        // console.log(tag);
        if (tag.isDeprecated) continue;
        if (!tag.postCount || tag.postCount < 10000) continue;
        if (tag.category == TagCategory.Meta) continue;

        const wikiPage = tag.wikiPageId ? await wikiPages.get(tag.wikiPageId) : undefined;

        yield {
            identifier: (await getLabelIdForTag(tag.id))!,
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            locales: [
                {
                    lang: 'en',
                    name: `${tagCategoryNames[tag.category ?? TagCategory.General]}: ${tag.name?.replace(/_/g, ' ') ?? wikiPage?.title?.replace(/_/g, ' ') ?? String(tag.id)}`,
                    description: removeDtext(extractFirstSentence(wikiPage?.body ?? `Images with the ${tag.name ?? wikiPage?.title ?? tag.id} tag on Danbooru.`))
                        // + (wikiPage?.otherNames?.length ? `\n\nOther names: ${wikiPage.otherNames.join(', ')}` : '')
                },
            ]
        } satisfies ComAtprotoLabelDefs.LabelValueDefinition;
    }
}

async function getLabelIdForTag(tag: number | string) {
    if (typeof tag === 'string') {
        if (tag.startsWith('dan-')) return tag;
        const tagId = await getOrDefault(tagsByName, tag);
        if (tagId) return `dan-${tagId.toString(36)}`;
    } else {
        return `dan-${tag.toString(36)}`;
    }
}

function indexOfAny(str: string, ...options: string[]) {
    const idxs = options.map(e => str.indexOf(e)).filter(e => e > -1);
    return idxs.length == 0 ? -1 : Math.min(...idxs);
}

function extractFirstSentence(str: string): string {
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

process.on('beforeExit', () => {
    db.close();
});