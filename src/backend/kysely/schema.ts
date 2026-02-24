import { Cid, Did } from "@atcute/lexicons";
import { Generated } from "kysely";
import { Rating } from "../../taggers/matcher";

export type DatabaseSchema = {
    tags: TagsTable;
    tagAliases: TagAliasesTable;
    tagImplications: TagImplicationsTable;
    wikiPages: WikiPagesTable;
    labels: LabelsTable;
    genericdb: KeyValueStoreTable;
    followers: FollowersTable;
    likers: LikersTable;
    config: ConfigTable;
    matches: MatchesTable;
}

//#region tag definitions
export const enum TagCategory {
    General = 0,
    Artist = 1,
    Copyright = 3,
    Character = 4,
    Meta = 5,
}

export interface TagsTable {
    id: number;
    name: string;
    words: string;              // JSON: string[]
    isDeprecated: 0 | 1 | null;
    updatedAt: string | null;
    createdAt: string | null;
    category: TagCategory | null;
    postCount: number | null;
}

export interface TagAliasesTable {
    id: number;
    forumPostId: string | null;
    forumTopicId: number | null;
    approverId: string | null;
    creatorId: number | null;
    updatedAt: string | null;
    createdAt: string | null;
    status: string | null;
    reason: string | null;
    antecedentName: string | null; // aka name of alias
    consequentName: string | null; // aka name of main tag
}

export interface TagImplicationsTable {
    id: number;
    forumPostId: number | null;
    forumTopicId: number | null;
    approverId: number | null;
    creatorId: number | null;
    updatedAt: string | null;
    createdAt: string | null;
    status: string | null;
    reason: string | null;
    antecedentName: string | null; // aka name of implying tag
    consequentName: string | null; // aka name of implied tag
}

export interface WikiPagesTable {
    id: number;
    title: string | null;
    body: string | null;
    otherNames: string;         // JSON: string[]
    isDeleted: 0 | 1 | null;
    isLocked: 0 | 1 | null;
    updatedAt: string | null;
    createdAt: string | null;
}

//#endregion

//#region labels
export interface LabelsTable {
    id: Generated<number>;
    src: Did;
    uri: string;
    cid: Cid | null;
    val: string;
    neg: 0 | 1 | null;
    cts: string;
    exp: string | null;
    sig: Uint8Array;
}
//#endregion

//#region keyvalue store
export interface KeyValueStoreTable {
    superkey: Uint8Array;
    key: Uint8Array;
    value: Uint8Array;
    version: number;
}
//#endregion

//#region labeler client
export interface FollowersTable {
    did: Did;
    rkey: string;
}

export interface LikersTable {
    did: Did;
    rkey: string;
}

export interface MatchesTable {
    imageUrl: string;

    similarity: number;

    md5?: string;
    sha1?: string;
    sha256?: string;
    rating?: Rating;
    sourceUrl?: string;
    pixivId?: number;
    fileSize?: number;

    /** Danbooru tag IDs for post */
    tags: string; // JSON: number[]
}
//#endregion

//#region config
export interface ConfigTable {
    key: string;
    value: Uint8Array;
}
//#endregion
