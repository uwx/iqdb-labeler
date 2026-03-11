import { Booru, PartialPost } from '../types.js';

export default abstract class Moebooru extends Booru<number, KonachanPost> {
    constructor(private readonly baseUrl: string) {
        super();
    }

    async getPost(id: number): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: false } | undefined): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: true }): Promise<KonachanPost>;
    async getPost(id: number, options?: { fullpost?: boolean }): Promise<KonachanPost | PartialPost> {
        const post = ((await this.baseHandler.get(`${this.baseUrl}/post.json?tags=id:${id}`)) as KonachanPost[])?.[0];

        if (!post) return { id, missing: true };

        return options?.fullpost ? post : this.makePartialPost(post);
    }

    makePartialPost(post: KonachanPost): PartialPost {
        if (post.status === 'deleted') return { id: post.id, deleted: true };

        return {
            id: post.id,
            deleted: false,

            image: [post.file_url, post.jpeg_url, post.sample_url, post.preview_url]
                .filter((e) => e !== undefined)
                .filter((e) => e),
            thumbnail_image: [post.sample_url, post.preview_url, post.jpeg_url, post.file_url]
                .filter((e) => e !== undefined)
                .filter((e) => e),

            rating: post.rating,
            tags: post.tags.split(' '),
            artist: [],
            source: post.source ? [post.source] : [],
            created_at: '' + post.created_at,
            ext: this.getUrlExt(post.file_url || post.jpeg_url || post.sample_url || post.preview_url), // TODO

            md5: post.md5,
        };
    }

    async search(after: number = 0, limit: number = 100): Promise<PartialPost[]> {
        if (limit > 100) {
            limit = 100;
        }

        return await this.baseHandler
            .get(`${this.baseUrl}/post/index.json?limit=${limit}&tags=${encodeURIComponent(`order:id id:>${after}`)}`)
            .then((e) => (e as KonachanPost[]).map((e) => this.makePartialPost(e)));
    }

    async getLastPostId(): Promise<number> {
        const posts = (await this.baseHandler.get(`${this.baseUrl}/post.json?limit=1`)) as KonachanPost[];
        return posts[0].id!;
    }
}

export interface KonachanPost {
    id: number;
    tags: string;
    created_at: number;
    creator_id: number;
    author: string;
    change: number;
    source: string;
    score: number;
    md5: string;
    file_size: number;
    file_url: string;
    is_shown_in_index: boolean;
    preview_url: string;
    preview_width: number;
    preview_height: number;
    actual_preview_width: number;
    actual_preview_height: number;
    sample_url: string;
    sample_width: number;
    sample_height: number;
    sample_file_size: number;
    jpeg_url: string;
    jpeg_width: number;
    jpeg_height: number;
    jpeg_file_size: number;
    rating: 'e' | 'q' | 's';
    has_children: boolean;
    parent_id: number | null;
    status: string;
    width: number;
    height: number;
    is_held: boolean;
    frames_pending_string: string;
    frames_pending: unknown[];
    frames_string: string;
    frames: unknown[];
}
