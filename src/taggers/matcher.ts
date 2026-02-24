import { createDb } from "../backend/kysely/index.js";import logger from "../backend/logger.js";
import { DB_PATH } from "../config.js";

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

const db = createDb(DB_PATH);

export abstract class Matcher {
    async getTagIdsByNameOrAlias(names: string[]): Promise<number[]> {
        const results = await db
            .selectFrom('tags')
            .select('id')
            .where((eb) => eb.or([
                eb('name', 'in', names),
                eb('name', 'in',
                    eb.selectFrom('tagAliases')
                        .select('consequentName')
                        .where('antecedentName', 'in', names)
                )
            ]))
            .execute();

        return results.map(r => r.id);
    }

    async getTagIdByNameOrAlias(name: string): Promise<number | undefined> {
        const result = await db
            .selectFrom('tags')
            .select('id')
            .where((eb) => eb.or([
                eb('name', '=', name),
                eb('name', '=', 
                    eb.selectFrom('tagAliases')
                        .select('consequentName')
                        .where('antecedentName', '=', name)
                        .limit(1)
                )
            ]))
            .executeTakeFirst();

        return result?.id;
    }

    async getMatch(imageUrl: string): Promise<Match | MatchError | void> {
        try {
            return await this.getMatchImpl(imageUrl);
        } catch (err) {
            return {error: err as Error};
        }
    }
    abstract getMatchImpl(imageUrl: string): Match | MatchError | PromiseLike<Match | MatchError | void> | void;
}
