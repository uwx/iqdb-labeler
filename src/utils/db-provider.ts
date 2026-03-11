import { Bytes, Cid, Did } from '@atcute/lexicons';

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
    ver?: number | bigint | null;
};
export type SignedLabel = UnsignedLabel & { sig: Uint8Array | Bytes };
export type FormattedLabel = UnsignedLabel & { sig?: Bytes };
export type SavedLabel = SignedLabel & { id: bigint; ver?: bigint | null };
export interface DbProvider {
    queryLabels(identifier: string, cursor?: number, limit?: number): Promise<SavedLabel[]> | SavedLabel[];
    saveLabel(label: SignedLabel): bigint | Promise<bigint>;
    saveLabels(labels: SignedLabel[]): bigint[] | Promise<bigint[]>;
    searchLabels(
        cursor?: number,
        limit?: number,
        uriPatterns?: string[],
        sources?: string[],
    ): Promise<SavedLabel[]> | SavedLabel[];

    isCursorInTheFuture(cursor: number): boolean | Promise<boolean>;
    getLatestCursor(): bigint | null | Promise<bigint | null>;
    iterateLabels(cursor?: number): Iterable<SavedLabel> | AsyncIterable<SavedLabel>;
}
