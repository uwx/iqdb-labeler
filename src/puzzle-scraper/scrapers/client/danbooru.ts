import { Booru, PartialPost } from "../types.js";

export default class Danbooru extends Booru<number, DanbooruPost> {
    constructor(private readonly baseUrl = 'https://danbooru.donmai.us') {
        super();
    }

    async getPost(id: number): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: false } | undefined): Promise<PartialPost>;
    async getPost(id: number, options: { fullpost: true }): Promise<DanbooruPost>;
    async getPost(id: number, options?: { fullpost?: boolean }): Promise<DanbooruPost | PartialPost> {
        const post = (await this.baseHandler.get(`${this.baseUrl}/posts/${id}.json`)) as DanbooruPost;

        return options?.fullpost ? post : this.makePartialPost(post);
    }

    makePartialPost(post: DanbooruPost): PartialPost {
        return {
            id: post.id!,

            image: post.file_url || post.large_file_url || post.preview_file_url,
            thumbnail_image: post.variants?.find(e => e.type === '720x720')?.url ?? post.variants?.find(e => e.type === '360x360')?.url ?? post.variants?.find(e => e.type === '180x180')?.url ?? post.file_url ?? post.large_file_url ?? post.preview_file_url,
            rating: post.rating as 'g' | 's' | 'q' | 'e',
            tags: post.tag_string?.split(' ') ?? [],
            artist: post.tag_string_artist?.split(' '),
            source: [post.source],
            created_at: post.created_at,
            ext: post.file_ext,

            md5: post.md5,
        };
    }

    async search(after: number = 0, limit: number = 200): Promise<PartialPost[]> {
        if (limit > 200) {
            limit = 200;
        }

        return await this.baseHandler.get(`${this.baseUrl}/posts.json?limit=${limit}&tags=${encodeURIComponent(`order:id id:>${after}`)}`)
            .then(e => (e as DanbooruPost[]).map(e => this.makePartialPost(e)));
    }

    async getLastPostId(): Promise<number> {
        const posts = (await this.baseHandler.get(`${this.baseUrl}/posts.json?limit=1`)) as DanbooruPost[];
        return posts[0].id!;
    }
}

export interface DanbooruPost {
    image?: string,
    tags?: Array<string> | undefined,
    artist?: string,
    source: string,
    id?: number,
    created_at: string,
    uploader_id?: number,
    score?: number,
    md5?: string,
    last_comment_bumped_at?: string | null,
    rating: string | null,
    image_width?: number,
    image_height?: number,
    tag_string?: string,
    is_note_locked?: boolean,
    fav_count?: number,
    file_ext?: string,
    last_noted_at?: string | null,
    is_rating_locked?: boolean,
    parrent_id?: number | null,
    has_children?: boolean,
    approver_id?: number | null,
    tag_count_general?: number,
    tag_count_artist?: number,
    tag_count_character?: number,
    tag_count_copyright?: number,
    file_size?: number,
    is_status_locked?: boolean,
    up_score?: number,
    down_score?: number,
    is_pending?: boolean,
    is_flagged?: boolean,
    is_deleted?: boolean,
    tag_count?: number,
    upstringd_at?: string,
    is_banned?: boolean,
    pixiv_id?: number | null,
    last_commented_at?: string | null,
    has_active_children?: boolean,
    bit_flags?: number,
    tag_count_meta?: number,
    has_large?: boolean,
    has_visible_children?: boolean,
    tag_string_general?: string,
    tag_string_character?: string,
    tag_string_artist?: string,
    tag_string_meta?: string,
    file_url?: string,
    large_file_url?: string,
    preview_file_url?: string,
    variants?: Variant[];
}

interface Variant {
    type: string,
    url: string,
    width: number,
    height: number,
    file_ext: string,
}