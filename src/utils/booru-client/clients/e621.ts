import { Booru, PartialPost } from "../types.js";

export const USER_AGENT = 'booru-scraper/1.0.0 (by spearcat.bsky.social on bluesky)';

export default class E621 extends Booru<number, E621Post> {
    private readonly userAgent: string;
    constructor(options: { userAgent: string } = { userAgent: USER_AGENT }) {
        super();
        this.userAgent = options.userAgent;
    }

    async getPost(id: number): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: false } | undefined): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: true }): Promise<E621Post>;
    async getPost(id: number, options?: { fullpost?: boolean }): Promise<E621Post | PartialPost> {
        const { post } = (await this.baseHandler.get(`https://e621.net/posts/${id}.json`, { userAgent: this.userAgent })) as { post: E621Post };

        return options?.fullpost ? post : this.makePartialPost(post) satisfies PartialPost;
    }

    makePartialPost(post: E621Post): PartialPost {
        const partialPost = {
            id: post.id!,
            deleted: false,

            image: [post.file?.url, ...(post.sample?.has ? [post.sample?.url] : [])].filter(e => e !== undefined).filter(e => e),
            thumbnail_image: [...(post.sample?.has ? [post.sample.url] : []), post.file?.url].filter(e => e !== undefined).filter(e => e),
            rating: post.rating as 'g' | 's' | 'q' | 'e',
            tags: Object.entries(post.tags).flatMap(([k, arr]) => arr.map(v => `${k}:${v}`)),
            artist: post.tags.artist ?? [],
            source: post.sources,
            created_at: post.created_at,
            ext: post.file?.ext ?? (post.sample?.has ? this.getUrlExt(post.sample.url) : undefined)!, // TODO

            md5: post.file?.md5,
        } satisfies PartialPost;

        if (!partialPost.thumbnail_image.length && (partialPost.tags.includes('general:loli') || partialPost.tags.includes('general:shota') || partialPost.tags.includes('general:young') || partialPost.tags.includes('general:cub'))) {
            return { id: post.id, missing: true }; // not available via API.
        }

        return partialPost;
    }

    async search(after: number = 0, limit: number = 320): Promise<PartialPost[]> {
        if (limit > 320) {
            limit = 320;
        }

        return await this.baseHandler.get(`https://e621.net/posts.json?limit=${limit}&page=a${after}`, { userAgent: this.userAgent })
            .then(e => ((e as { posts: E621Post[] }).posts as E621Post[]).map(e => this.makePartialPost(e)));
    }

    async getLastPostId(): Promise<number> {
        const posts = (await this.baseHandler.get(`https://e621.net/posts.json?limit=1`, { userAgent: this.userAgent })) as E621Post[];
        return posts[0].id!;
    }
}

export interface E621Post {
    id: number,
    image?: string,
    rating: string,
    tags: {
        general?: string[],
        species?: string[],
        character?: string[],
        artist?: string[],
        invalid?: string[],
        lore?: string[],
        meta?: string[],
    },
    author?: string[] | undefined,
    sources: string[],
    created_at: string,
    updated_at?: string,
    file?: {
        width?: number,
        height?: number,
        ext?: string,
        md5?: string,
        url?: string,
    }
    preview?: {
        width?: number,
        height?: number,
        url?: string,
    },
    sample?: { has?: false } | {
        has: true,
        width?: number,
        height?: number,
        url?: string,
        alternates?: object,
    },
    score?: {
        up?: number,
        down?: number,
        total?: number,
    },
    locked_tags?: string[],
    change_seq?: number,
    flags?: {
        pending?: boolean,
        flagged?: boolean,
        note_locked?: boolean,
        status_locked?: boolean,
        rating_locked?: boolean,
        deleted?: boolean,
    },
    fav_count?: number,
    pools?: unknown[],
    relationships?: {
        parent_id?: number,
        has_children?: boolean,
        has_active_children?: boolean,
        children?: unknown[],
    },
    approver_id?: number | null,
    uploader_id?: number,
    description?: string,
    comment_count?: number,
    is_favorited?: boolean,
    has_notes?: boolean,
    duration?: number,
}
