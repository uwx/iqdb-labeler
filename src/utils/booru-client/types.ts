import BaseHandler from './handlers/_.js';

export type PartialPost =
    | { id: number; deleted: true }
    | { id: number; missing: true }
    | {
          id: number;

          missing?: false;
          deleted?: false;

          image: string[];
          thumbnail_image: string[];
          rating: 'g' | 's' | 'q' | 'e';
          tags: string[];
          artist: string[];
          source: string[];
          created_at: string;
          ext: string;

          md5?: string;
          sha1?: string;
      };

export abstract class Booru<PostKey extends number | string, FullPostType> {
    protected readonly baseHandler = new BaseHandler();
    abstract getPost(id: number): Promise<PartialPost>;
    abstract getPost(id: PostKey, options: { fullpost: false } | undefined): Promise<PartialPost>;
    abstract getPost(id: PostKey, options: { fullpost: true }): Promise<FullPostType>;
    abstract getPost(id: PostKey, options?: { fullpost?: boolean }): Promise<FullPostType | PartialPost>;
    abstract getLastPostId(): Promise<number>;
    abstract search(after?: number, limit?: number): Promise<PartialPost[]>;

    getUrlExt(url: string): string;
    getUrlExt(url: undefined): undefined;
    getUrlExt(): undefined;
    getUrlExt(url?: string): string | undefined;
    getUrlExt(url?: string) {
        if (!url) return undefined;

        const urlUrl = new URL(url);
        return urlUrl.pathname.slice(urlUrl.pathname.lastIndexOf('.') + 1);
    }
}
