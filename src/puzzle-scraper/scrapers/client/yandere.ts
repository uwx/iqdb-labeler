import baseHandler from "./handlers/_";
export default class yandere {
    constructor(options?: yandereOptions) {
        this.fullpost = options?.fullpost;
        this.limit = options?.limit ?? 50;
        this.tags = options?.tags?.join('+') ?? '';
        const urlOptions = `limit=${this.limit}&tags=${this.tags}`
        this.post = new Promise((resolve) => {
            new baseHandler().get(`https://yande.re/post.json?${urlOptions}`).then((posts: any) => {
                const post: yanderePost = posts[Math.floor(Math.random() * posts.length)];
                this.fullpost ? resolve(post) : resolve({
                    image: post.file_url,
                    rating: post.rating,
                    tags: `${post.tags}`.split(' '),
                    source: post.source,
                    created_at: post.created_at,
                    author: post.author,
                })
            })
        })
    }
    fullpost: boolean | undefined;
    limit: number;
    tags: string;
    post: Promise<yanderePost>;
}

type yandereOptions = {
    tags?: Array<string>,
    limit?: number,
    fullpost?: boolean | undefined,
}

type yanderePost = {
    image?: string,
    rating: string,
    tags: string | Array<string>,
    source: string,
    created_at: number,
    author: string,
    id?: number,
    updated_at?: number,
    creator_id?: number,
    approver_id?: number | null,
    change?: number,
    score?: number,
    md5?: string,
    file_size?: number,
    file_ext?: string,
    file_url?: string,
    is_shown_in_index?: boolean,
    preview_url?: string,
    preview_width?: number,
    preview_height?: number,
    actual_preview_width?: number,
    actual_preview_height?: number,
    sample_url?: string,
    sample_width?: number,
    sample_height?: number,
    sample_file_size?: number,
    jpeg_url?: string,
    jpeg_width?: number,
    jpeg_height?: number,
    jpeg_file_size?: number,
    is_rating_locked?: boolean,
    has_children?: boolean,
    parent_id?: number,
    status?: string,
    is_peding?: boolean,
    width?: number,
    height?: number,
    is_held?: boolean,
    frames_pending_string?: string,
    frames_pending?: Array<unknown>,
    frames_string?: Array<unknown>,
    frames?: Array<unknown>,
    is_note_locked?: boolean,
    last_noted_at?: number,
    last_commented_at?: number,
}
