import { Bytes, ResourceUri } from '@atcute/lexicons';
import { LabelEvent, LabelStore, SignedLabel } from '@atcute/labeler';
import { DbProvider } from './db-provider.ts';

export class DbLabelStore implements LabelStore {
    startingCursor = 100_000_000;

    constructor(private readonly db: DbProvider) {}

    async appendLabels(labels: SignedLabel[]): Promise<LabelEvent[]> {
        const seqs = await this.db.saveLabels(labels);
        return seqs.map((seq, i) => ({
            seq: Number(seq),
            labels: [labels[i]],
        }));
    }
    async getLatestSeq(): Promise<number | null> {
        return Math.max(this.startingCursor, Number((await this.db.getLatestCursor()) ?? 0));
    }
    async listLabelEvents(options: { after?: number; limit?: number }): Promise<LabelEvent[]> {
        const { after = 0, limit = 100 } = options;
        const labels = await this.db.searchLabels(after, limit);

        return labels.map((label) => ({
            seq: Number(label.id),
            labels: [
                {
                    cts: label.cts,
                    src: label.src,
                    val: label.val,
                    uri: label.uri as ResourceUri,
                    cid: label.cid ?? undefined,
                    exp: label.exp ?? undefined,
                    neg: label.neg ?? undefined,
                    ver: label.ver != null ? Number(label.ver) : undefined,
                    sig:
                        label.sig instanceof Uint8Array
                            ? ({
                                  $bytes: Buffer.from(label.sig).toString('base64'),
                              } satisfies Bytes)
                            : label.sig,
                },
            ],
        }));
    }
}
