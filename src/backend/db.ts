import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({ url: process.env.DB_FILE_NAME! });
await client.execute('pragma journal_mode = WAL');
export const db = drizzle({ client });

export function takeUniqueOrThrow<T>(values: T[]): T {
    if (values.length !== 1)
        throw new Error("Found non unique or inexistent value");
    return values[0];
};

export function takeUniqueOrUndefined<T>(values: T[]): T | undefined {
    if (values.length !== 1)
        return undefined;
    return values[0];
};
