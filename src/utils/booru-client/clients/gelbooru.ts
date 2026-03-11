import { extname } from 'path';
import { Booru, PartialPost } from '../types.js';

export default class Gelbooru extends Booru<number, GelbooruPost> {
    constructor(private readonly baseUrl = 'https://gelbooru.com') {
        super();
    }

    async getPost(id: number): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: false } | undefined): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: true }): Promise<GelbooruPost>;
    async getPost(id: number, options?: { fullpost?: boolean }): Promise<GelbooruPost | PartialPost> {
        const post = (await this.baseHandler.get(`${this.baseUrl}/index.php?page=dapi&s=post&q=index&id=${id}`, {
            xml: true,
        })) as GelbooruResult;

        if (!post.posts?.post[0]) return { id, missing: true };

        return options?.fullpost ? post.posts.post[0] : this.makePartialPost(post.posts.post[0]);
    }

    makePartialPost(post: GelbooruPost): PartialPost {
        if (post.status === 'deleted') return { id: Number(post.id), deleted: true };

        return {
            id: Number(post.id),
            deleted: false,

            image: [post.file_url, post.sample_url, post.preview_url].filter((e) => e !== undefined).filter((e) => e),
            thumbnail_image: [post.sample_url, post.preview_url, post.file_url]
                .filter((e) => e !== undefined)
                .filter((e) => e),

            rating: post.rating,
            tags: post.tags?.split(' ') ?? [],
            artist: [],
            source: post.source ? [post.source] : [],
            created_at: post.created_at,
            ext: this.getUrlExt(post.sample_url || post.preview_url || post.file_url), // TODO

            md5: post.md5,
        };
    }

    async search(after: number = 0, limit: number = 1000): Promise<PartialPost[]> {
        if (limit > 1000) {
            limit = 1000;
        }

        return await this.baseHandler
            .get(
                `${this.baseUrl}/index.php?page=dapi&s=post&q=index&tags=${encodeURIComponent(`sort:id:asc id:>${after}`)}`,
                { xml: true },
            )
            .then((e) => (e as GelbooruResult).posts.post.map((e) => this.makePartialPost(e)));
    }

    async getLastPostId(): Promise<number> {
        const posts = (await this.baseHandler.get(`${this.baseUrl}/index.php?page=dapi&s=post&q=index&limit=1`, {
            xml: true,
        })) as GelbooruResult;
        return Math.max(...posts.posts.post.map((e) => Number(e.id)));
    }
}

export interface GelbooruPost {
    height: string;
    score: string;
    file_url: string;
    parent_id: string;
    sample_url: string;
    sample_width: string;
    sample_height: string;
    preview_url: string;
    rating: 's' | 'q' | 'e';
    tags: string;
    id: string;
    width: string;
    change: string;
    md5: string;
    creator_id: string;
    has_children: string;
    created_at: string;
    status: string;
    source: string;
    has_notes: string;
    has_comments: string;
    preview_width: string;
    preview_height: string;
}

export interface GelbooruResult {
    posts: {
        post: GelbooruPost[];
        '#text': string;
        count: string;
        offset: string;
    };
}
