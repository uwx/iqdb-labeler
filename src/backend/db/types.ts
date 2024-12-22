import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

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
     * @kyselyType(boolean)
     */
    neg: Generated<boolean | null>;
    cts: string;
    exp: string | null;
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
    words: string;
    /**
     * @kyselyType(boolean)
     */
    isDeprecated: boolean | null;
    updatedAt: string | null;
    createdAt: string | null;
    category: number | null;
    postCount: number | null;
};
export type TagAlias = {
    id: number;
    forumPostId: number | null;
    forumTopicId: number | null;
    approverId: number | null;
    creatorId: number | null;
    updatedAt: string | null;
    createdAt: string | null;
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
    updatedAt: string | null;
    createdAt: string | null;
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
     * @kyselyType(boolean)
     */
    isDeleted: boolean | null;
    /**
     * @kyselyType(boolean)
     */
    isLocked: boolean | null;
    updatedAt: string | null;
    createdAt: string | null;
};
export type DB = {
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
