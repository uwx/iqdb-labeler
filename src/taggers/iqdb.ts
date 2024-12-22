import { getOrDefault, tagsByName, tagsByNameOrAlias } from '../labels/index.js';
import { IQDBLibs_2D, makeSearchFunc } from './iqdb-client/src/index.js';
import { Matcher, Rating } from './matcher.js';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace DanbooruSchema {
    export interface Post {
        id: number; // >0
        uploader_id: number; // >0
        approver_id?: number; // >0

        tag_string: string;
        tag_string_general: string;
        tag_string_character: string;
        tag_string_copyright: string;
        tag_string_artist: string;
        tag_string_meta: string;

        tag_count: number;
        tag_count_general: number;
        tag_count_character: number;
        tag_count_copyright: number;
        tag_count_artist: number;
        tag_count_meta: number;

        created_at: string; // Date
        updated_at: string; // Date

        last_comment_bumped_at: string; // Date
        last_noted_at: string; // Date
        last_commented_at?: string; // Date

        score: number;

        source: string; // URL
        md5: string;

        rating: Rating;

        image_width: number;
        image_height: number;
        file_ext: string;

        fav_count: number;

        parent_id?: number;
        has_children: boolean;

        file_size: number;

        up_score: number;
        down_score: number;

        is_pending: boolean;
        is_flagged: boolean;
        is_deleted: boolean;
        is_banned: boolean;
        pixiv_id?: number;

        bit_flags: number;

        has_large: boolean;
        has_active_children: boolean;
        has_visible_children: boolean;

        media_asset: MediaAsset;

        file_url: string;
        large_file_url: string;
        preview_file_url: string;
    }

    export interface MediaAsset {
        id: number;
        created_at: string; // Date
        updated_at: string; // Date
        md5: string;
        file_ext: string;
        file_size: number;
        image_width: number;
        image_height: number;
        duration?: number;
        status: string;
        file_key: string;
        is_public: boolean;
        pixel_hash: string;
        variants: Variant[];
    }

    export interface Variant {
        type: string; // e.g 180x180
        url: string;
        width: number;
        height: number;
        file_ext: string;
    }
}

const USER_AGENT = 'bsky-iqdb-labeler/1.0.0';

const searchPic = makeSearchFunc({
    baseDomain: 'iqdb.org',
    similarityPass: 0.8,
    userAgent: USER_AGENT,
});

function extractDanbooruPostId(url: string) {
    return url.match(/danbooru\.donmai\.us\/posts\/(\d+)/i)?.[1];
}

export class IqdbMatcher extends Matcher {
    async getMatch(imageUrl: string) {
        const result = await searchPic(imageUrl, {
            lib: 'www',
            service: [
                IQDBLibs_2D.danbooru,
                IQDBLibs_2D.konachan,
                IQDBLibs_2D['yande.re'],
                IQDBLibs_2D.gelbooru,
                IQDBLibs_2D['sankaku channel'],
                IQDBLibs_2D['e-shuushuu'],
                IQDBLibs_2D.zerochan,
                IQDBLibs_2D['anime-picture'],
            ]
        });

        if (result.ok) {
            const bestMatches = result.data
                .filter(e => e.head != 'Your image')
                .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

            const danbooruMatch = bestMatches.find(e => e.sourceUrl?.includes('danbooru.donmai.us'));
            if (danbooruMatch) {
                const postId = extractDanbooruPostId(danbooruMatch.sourceUrl!)
                const post = (await fetch(`https://danbooru.donmai.us/posts/${postId}.json`, {
                    headers: {
                        'User-Agent': USER_AGENT
                    }
                }).then(e => e.json())) as DanbooruSchema.Post;

                const tags: number[] = [];
                for (const tag of post.tag_string.split(' ')) {
                    const tagId = await getOrDefault(tagsByNameOrAlias, tag);
                    if (tagId !== undefined) {
                        tags.push(tagId);
                    }
                }

                return {
                    similarity: danbooruMatch.similarity ?? 0.1,

                    md5: post.md5,
                    rating: post.rating,
                    sourceUrl: post.source,
                    pixivId: post.pixiv_id,
                    fileSize: post.file_size,
                    tags
                };
            }
        } else if ('err' in result) {
            return { error: result.err ?? 'Unknown error' };
        }
    }
}