import { db } from '../backend/db.js';

class Configuration<T extends object> {
    private constructor(private readonly key?: string) {
    }
    
    static async getConfiguration<T extends object>(key?: string) {
        return new Configuration<T>(key);
    }

    subconfig<T extends object>(subkey: string) {
        return new Configuration<T>(this.key ? `${this.key}.${subkey}` : subkey);
    }

    private getActualKey(key: string) {
        return this.key ? `${this.key}.${key}` : key;
    }
    
    async get<K extends keyof T & string>(key: K): Promise<Awaited<T[K]> | undefined> {
        const value = await db
            .selectFrom('Config')
            .where('key', '==', this.getActualKey(key))
            .select('value')
            .limit(1)
            .executeTakeFirst();
        
        return value?.value ? JSON.parse(value.value) : undefined;
    }

    async set<K extends keyof T & string>(key: K, value: T[K]): Promise<void> {
        await db
            .insertInto('Config')
            .values({
                key: this.getActualKey(key),
                value: JSON.stringify(value)
            })
            .onConflict(oc =>
                oc.column('key')
                    .doUpdateSet({ value: JSON.stringify(value) })
            )
            .execute();
    }

    async remove<K extends keyof T & string>(key: K) {
        await db
            .deleteFrom('Config')
            .where('key', '==', this.getActualKey(key))
            .execute();
    }
}

interface MainConfig {
    jetstreamCursor: number;
    trackedUsers: {
        likers: { rkey: string | null, did: string }[];
        followers: { rkey: string | null, did: string }[];
    };
}

export const config = await Configuration.getConfiguration<MainConfig>();
