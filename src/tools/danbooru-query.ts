import 'dotenv/config';

import { BigQuery, RowMetadata } from '@google-cloud/bigquery';
import { mkdir, open } from 'node:fs/promises';
import StreamToAsyncIterator from './util/stream-to-async-iterator.js';

// Creates a client
const bigqueryClient = new BigQuery({
    projectId: process.env.GCLOUD_PROJECT_ID
});

function sql(strings: TemplateStringsArray, ...values: any[]) {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
        result += strings[i];
        if (i < values.length) {
            result += values[i];
        }
    }
    return result;
}

const queries = {
    tags: sql`
    SELECT
        category,
        created_at,
        id,
        is_deprecated,
        name,
        post_count,
        updated_at
    FROM
        danbooru1.danbooru_public.tags;
    `,
    wiki_pages: sql`
    SELECT
        body,
        created_at,
        id,
        is_deleted,
        is_locked,
        title,
        updated_at,
        other_names
    FROM
        danbooru1.danbooru_public.wiki_pages;
    `,
    tag_implications: sql`
    SELECT
        forum_post_id,
        approver_id,
        updated_at,
        forum_topic_id,
        status,
        id,
        creator_id,
        created_at,
        antecedent_name,
        reason,
        consequent_name
    FROM danbooru1.danbooru_public.tag_implications;
    `,
    tag_aliases: sql`
    SELECT
        forum_post_id,
        approver_id,
        updated_at,
        forum_topic_id,
        status,
        id,
        creator_id,
        created_at,
        antecedent_name,
        reason,
        consequent_name
    FROM danbooru1.danbooru_public.tag_aliases;
    `
}

await mkdir('./danbooru-data', { recursive: true });

for (const [name, query] of Object.entries(queries)) {
    // Create the dataset
    const data = bigqueryClient.createQueryStream(query);

    const stream = await open(`./danbooru-data/${name}.jsonl`, 'w');

    for await (const chunk of new StreamToAsyncIterator<RowMetadata>(data)) {
        console.log(chunk);
        await stream.write(JSON.stringify(chunk), null, 'utf-8');
        await stream.write('\n', null, 'utf-8');
    }

    await stream.close();

    // await writeFile('./danbooru-data.json', JSON.stringify(data, null, 1));
}

export interface BQDate {
    value: string; // Date e.g 2013-02-16T08:42:16.949Z
}

export interface BQTag {
    id: number;

    name?: string;
    words: string[];

    is_deprecated?: boolean;

    updated_at?: BQDate;
    created_at?: BQDate;

    category?: number;
    post_count?: number;
}

export interface BQWikiPage {
    id: number;

    title?: string;
    body?: string;

    other_names?: string[];

    is_deleted?: boolean;
    is_locked?: boolean;

    updated_at?: BQDate;
    created_at?: BQDate;
}

export interface BQTagImplication {
    id: number;

    forum_post_id?: number;
    forum_topic_id?: number;
    approver_id?: number;
    creator_id?: number;

    updated_at?: BQDate;
    created_at?: BQDate;

    status?: string;
    reason?: string;

    antecedent_name?: string;
    consequent_name?: string;
}

export interface BQTagAlias {
    id: number;

    forum_post_id?: string;
    forum_topic_id?: number;
    approver_id?: string;
    creator_id?: number;

    updated_at?: BQDate;
    created_at?: BQDate;

    status?: string;
    reason?: string;

    antecedent_name?: string;
    consequent_name?: string;
}
