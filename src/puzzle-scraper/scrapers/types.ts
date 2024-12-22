import BaseHandler from "./client/handlers/_.js";

export interface PartialPost {
    id: number;

    image?: string;
    thumbnail_image?: string;
    rating: 'g' | 's' | 'q' | 'e';
    tags: string[];
    artist?: string[];
    source?: string[];
    created_at: string;
    ext?: string;

    md5?: string;
    sha1?: string;
}

export abstract class Booru<PostKey extends number | string, FullPostType> {
    protected readonly baseHandler = new BaseHandler();
    abstract getPost(id: number): Promise<PartialPost>;
    abstract getPost(id: PostKey, options: { fullpost: false } | undefined): Promise<PartialPost>;
    abstract getPost(id: PostKey, options: { fullpost: true }): Promise<FullPostType>;
    abstract getPost(id: PostKey, options?: { fullpost?: boolean }): Promise<FullPostType | PartialPost>;
    abstract getLastPostId(): Promise<number>;
    abstract search(after?: number, limit?: number): Promise<PartialPost[]>;
}
