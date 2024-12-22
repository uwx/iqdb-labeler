import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Cursor = {
    serviceName: string;
    cursorId: number;
};
export type Hash = {
    hash: Buffer;
    hashType: number;
    service: number;
    id: number;
};
export type Post = {
    service: number;
    id: number;
    /**
     * @kyselyType(1 | 0)
     */
    missing: 1 | 0;
    /**
     * @kyselyType(1 | 0)
     */
    deleted: 1 | 0;
    image: string | null;
    thumbnailImage: string | null;
    /**
     * @kyselyType('g' | 's' | 'q' | 'e' | null)
     */
    rating: 'g' | 's' | 'q' | 'e' | null | null;
    tags: string | null;
    artist: string | null;
    source: string | null;
    createdAt: string | null;
    ext: string | null;
    md5: string | null;
    sha1: string | null;
};
export type PostError = {
    service: number;
    id: number;
    error: string;
};
export type ScraperEntry = {
    service: number;
    id: number;
    md5: string | null;
    sha1: string | null;
};
export type DB = {
    Cursor: Cursor;
    Hash: Hash;
    Post: Post;
    PostError: PostError;
    ScraperEntry: ScraperEntry;
};
