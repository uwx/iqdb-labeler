import baseHandler from "./handlers/_";
export default class rule34 {
    constructor(options?: rule34Options) {
        this.fullpost = options?.fullpost;
        this.limit = options?.limit ?? 50;
        this.tags = options?.tags?.join('+') ?? '';
        const urlOptions = `limit=${this.limit}&tags=${this.tags}`
        this.post = new Promise((resolve) => {
            new baseHandler().get(`https://rule34.xxx/index.php?page=dapi&s=post&q=index&${urlOptions}`, { XML: true }).then((posts: any) => {
                const post: rule34Post = posts.posts.post[Math.floor(Math.random() * posts.posts.post.length)];
                this.fullpost ? resolve(post) : resolve({
                    image: post.file_url,
                    rating: post.rating,
                    tags: `${post.tags}`.split(' '),
                    source: post.source,
                    created_at: post.created_at,
                })
            })
        })
    }
    fullpost: boolean | undefined;
    limit: number;
    tags: string;
    post: Promise<rule34Post>;
}

type rule34Options = {
    tags?: Array<string>,
    limit?: number,
    fullpost?: boolean | undefined,
}

type rule34Post = {
    height?: string,
    score?: string,
    file_url?: string,
    parent_id?: string,
    sample_url?: string,
    sample_width?: string,
    sample_height?: string,
    preview_url?: string,
    rating: string,
    tags: string | Array<string>,
    id?: string,
    width?: string,
    change?: string,
    md5?: string,
    creator_id?: string,
    has_children?: string,
    created_at: string,
    status?: string,
    source: string,
    has_notes?: string,
    has_comments?: string,
    preview_width?: string,
    preview_height?: string,
    image: string | undefined,
}
