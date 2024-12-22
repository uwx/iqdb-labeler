import baseHandler from "./handlers/_";
export default class konachan {
    constructor(options?: konachanOptions) {
        this.fullpost = options?.fullpost;
        this.limit = options?.limit ?? 50;
        this.tags = options?.tags?.join('+') ?? '';
        const urlOptions = `limit=${this.limit}&tags=${this.tags}`
        this.post = new Promise((resolve) => {
            new baseHandler().get(`https://konachan.com/post.json?${urlOptions}`).then((posts: any) => {
                const post: konachanPost = posts[Math.floor(Math.random() * posts.length)];
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
    post: Promise<konachanPost>;
}

type konachanOptions = {
    tags?: Array<string>,
    limit?: number,
    fullpost?: boolean | undefined,
}

type konachanPost = {
    image?: string,
    rating: string,
    tags: string | Array<string>,
    source: string,
    created_at: number,
    author: string,
    id?: number,
    creator_id?: number,
    change?: number,
    score?: number,
    md5?: string,
    file_size?: number,
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
    has_children?: boolean,
    parent_id?: number,
    status?: string,
    width?: number,
    height?: number,
    is_held?: boolean,
    frames_pending_string?: string,
    frames_pending?: Array<unknown>,
    frames_string?: Array<unknown>,
    frames?: Array<unknown>,
}
