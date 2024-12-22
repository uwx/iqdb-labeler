import { Kysely, sql } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { DB } from './db/types.js';

export const db = new Kysely<DB>({
    dialect: new LibsqlDialect({
        url: "file:./db/main.db",
    }),
});

sql`PRAGMA journal_mode = WAL`.execute(db)
