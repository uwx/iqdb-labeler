import logger from "../logger.js";

export const enum Rating {
    General = 'g',
    Safe = 's',
    Questionable = 'q',
    Explicit = 'e',
}

export interface Match {
    similarity: number;

    md5?: string;
    sha1?: string;
    sha256?: string;
    rating?: Rating;
    sourceUrl?: string;
    pixivId?: number;
    fileSize?: number;

    /** Danbooru tag IDs for post */
    tags: number[];
}
export interface MatchError {
    error: string | Error;
}

export abstract class Matcher {
    async getMatch(imageUrl: string): Promise<Match | MatchError | void> {
        try {
            return await this.getMatchImpl(imageUrl);
        } catch (err) {
            return {error: err as Error};
        }
    }
    abstract getMatchImpl(imageUrl: string): Match | MatchError | PromiseLike<Match | MatchError | void> | void;
}