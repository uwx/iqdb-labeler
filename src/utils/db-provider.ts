import { Bytes, Cid, Did } from "@atcute/lexicons";

export type UnsignedLabel = {
    /** Timestamp when this label was created. */
    cts: string;
    /** DID of the actor who created this label. */
    src: Did;
    /** AT URI of the record, repository (account), or other resource that this label applies to. */
    uri: string;
    /**
     * The short string name of the value or type of this label. \
     * Maximum string length: 128
     */
    val: string;
    /** Optionally, CID specifying the specific version of 'uri' resource this label applies to. */
    cid?: Cid | null;
    /** Timestamp at which this label expires (no longer applies). */
    exp?: string | null;
    /** If true, this is a negation label, overwriting a previous label. */
    neg?: boolean | null;
    /** The AT Protocol version of the label object. */
    ver?: number | null;
};
export type SignedLabel = UnsignedLabel & { sig: Uint8Array | Bytes };
export type FormattedLabel = UnsignedLabel & { sig?: Bytes };
export type SavedLabel = SignedLabel & { id: number };

export interface DbProvider {
    queryLabels(identifier: string, cursor?: number, limit?: number): Promise<SavedLabel[]> | SavedLabel[];
    saveLabel(label: SignedLabel): number | Promise<number>;
    saveLabels(labels: SignedLabel[]): number[] | Promise<number[]>;
    searchLabels(cursor?: number, limit?: number, uriPatterns?: string[], sources?: string[]): Promise<SavedLabel[]> | SavedLabel[];

    isCursorInTheFuture(cursor: number): boolean | Promise<boolean>;
    getLatestCursor(): number | null | Promise<number | null>;
    iterateLabels(cursor?: number): Iterable<SavedLabel> | AsyncIterable<SavedLabel>;
}