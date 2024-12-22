import { Booru, PartialPost } from "../types.js";

export default class Danbooru extends Booru<number, DanbooruSchema.Post> {
    constructor(private readonly baseUrl = 'https://danbooru.donmai.us') {
        super();
    }

    async getPost(id: number): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: false } | undefined): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: true }): Promise<DanbooruSchema.Post>;
    async getPost(id: number, options?: { fullpost?: boolean }): Promise<DanbooruSchema.Post | PartialPost> {
        const post = (await this.baseHandler.get(`${this.baseUrl}/posts/${id}.json`)) as DanbooruSchema.Post;

        return options?.fullpost ? post : this.makePartialPost(post);
    }

    makePartialPost(post: DanbooruSchema.Post): PartialPost {
        if (post.is_deleted || post.is_banned) return { id: post.id, deleted: true };

        const partialPost = {
            id: post.id,
            deleted: false,

            image: [post.file_url, post.large_file_url, post.preview_file_url].filter(e => e !== undefined).filter(e => e),
            thumbnail_image: [
                post.media_asset.variants?.find(e => e.type === '720x720')?.url,
                post.media_asset.variants?.find(e => e.type === '360x360')?.url,
                post.media_asset.variants?.find(e => e.type === '180x180')?.url,
                post.variants?.find(e => e.type === '720x720')?.url,
                post.variants?.find(e => e.type === '360x360')?.url,
                post.variants?.find(e => e.type === '180x180')?.url,
                post.file_url,
                post.large_file_url,
                post.preview_file_url,
            ].filter(e => e !== undefined).filter(e => e),

            rating: post.rating,
            tags: post.tag_string?.split(' ') ?? [],
            artist: post.tag_string_artist?.split(' '),
            source: post.source ? [post.source] : [],
            created_at: post.created_at,
            ext: post.file_ext,

            md5: post.md5,
        } satisfies PartialPost;

        if (!partialPost.thumbnail_image.length && (partialPost.tags.includes('loli') || partialPost.tags.includes('shota'))) {
            return { id: post.id, missing: true }; // not available via API.
        }

        return partialPost;
    }

    async search(after: number = 0, limit: number = 200): Promise<PartialPost[]> {
        if (limit > 200) {
            limit = 200;
        }

        return await this.baseHandler.get(`${this.baseUrl}/posts.json?limit=${limit}&tags=${encodeURIComponent(`order:id id:>${after}`)}`)
            .then(e => (e as DanbooruSchema.Post[]).map(e => this.makePartialPost(e)));
    }

    async getLastPostId(): Promise<number> {
        const posts = (await this.baseHandler.get(`${this.baseUrl}/posts.json?limit=1`)) as DanbooruSchema.Post[];
        return posts[0].id!;
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DanbooruSchema {
    export const enum Rating {
        General = 'g',
        Safe = 's',
        Questionable = 'q',
        Explicit = 'e',
    }

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

        variants?: Variant[];
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