import { ConfigurationStorage } from 'config-storage';

class Configuration<T extends object> {
    private constructor(private readonly storage: ConfigurationStorage, private readonly key?: string) {
    }
    
    static async getConfiguration<T extends object>(key?: string) {
        return new Configuration<T>(await ConfigurationStorage.getStorage('iqdb-labeler'), key);
    }

    subconfig<T extends object>(subkey: string) {
        return new Configuration<T>(this.storage, this.key ? `${this.key}.${subkey}` : subkey);
    }
    
    async get<K extends keyof T & string>(key: K): Promise<Awaited<T[K]> | undefined> {
        return await this.storage.get(this.key ? `${this.key}.${key}` : key);
    }

    async set<K extends keyof T & string>(key: K, value: T[K]): Promise<void> {
        return await this.storage.set(this.key ? `${this.key}.${key}` : key, value);
    }

    async remove<K extends keyof T & string>(key: K) {
        await this.storage.del(this.key ? `${this.key}.${key}` : key);
    }
}

interface MainConfig {
    jetstreamCursor: number;
}

export const config = await Configuration.getConfiguration<MainConfig>();
