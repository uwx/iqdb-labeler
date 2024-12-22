import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Config = {
    key: string;
    value: string | null;
};
export type Follower = {
    did: string;
    rkey: string;
};
export type Label = {
    id: Generated<number>;
    src: string;
    uri: string;
    cid: string | null;
    val: string;
    /**
     * @kyselyType(1 | 0)
     */
    neg: Generated<1 | 0 | null>;
    cts: number;
    exp: number | null;
    sig: Buffer;
};
export type Liker = {
    did: string;
    rkey: string;
};
export type Match = {
    url: string;
    similarity: number | null;
    md5: string | null;
    sha1: string | null;
    sha256: string | null;
    /**
     * @kyselyType('g' | 's' | 'q' | 'e')
     */
    rating: 'g' | 's' | 'q' | 'e' | null;
    sourceUrl: string | null;
    pixivId: number | null;
    fileSize: number | null;
    tags: string;
};
export type Tag = {
    id: number;
    name: string | null;
    words: string | null;
    /**
     * @kyselyType(1 | 0)
     */
    isDeprecated: 1 | 0 | null;
    updatedAt: number | null;
    createdAt: number | null;
    category: number | null;
    postCount: number | null;
};
export type TagAlias = {
    id: number;
    forumPostId: number | null;
    forumTopicId: number | null;
    approverId: number | null;
    creatorId: number | null;
    updatedAt: number | null;
    createdAt: number | null;
    status: string | null;
    reason: string | null;
    antecedentName: string | null;
    consequentName: string | null;
};
export type TagImplication = {
    id: number;
    forumPostId: number | null;
    forumTopicId: number | null;
    approverId: number | null;
    creatorId: number | null;
    updatedAt: number | null;
    createdAt: number | null;
    status: string | null;
    reason: string | null;
    antecedentName: string | null;
    consequentName: string | null;
};
export type User = {
    id: Generated<number>;
    email: string;
    name: string | null;
};
export type WikiPage = {
    id: number;
    title: string | null;
    body: string | null;
    otherNames: string;
    /**
     * @kyselyType(1 | 0)
     */
    isDeleted: 1 | 0 | null;
    /**
     * @kyselyType(1 | 0)
     */
    isLocked: 1 | 0 | null;
    updatedAt: number | null;
    createdAt: number | null;
};
export type DB = {
    Config: Config;
    Follower: Follower;
    Label: Label;
    Liker: Liker;
    Match: Match;
    Tag: Tag;
    TagAlias: TagAlias;
    TagImplication: TagImplication;
    User: User;
    WikiPage: WikiPage;
};
