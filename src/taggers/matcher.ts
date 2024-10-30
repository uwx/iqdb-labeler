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

    tags: number[];
}
export interface MatchError {
    error: string;
}

export abstract class Matcher {
    abstract getMatch(imageUrl: string): Match | MatchError | PromiseLike<Match | MatchError | void> | void;
}