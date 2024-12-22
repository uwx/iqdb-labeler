import { Kysely, SqliteDialect, sql } from "kysely";
import SQLite from 'better-sqlite3'
import { DB } from './db/types.js';
import logger from "./logger.js";

export const db = new Kysely<DB>({
    dialect: new SqliteDialect({
        database: new SQLite("./db/main.db"),
    }),
    log(event) {
        if (event.level === "error") {
            logger.error({
                error: event.error,
                sql: event.query.sql,
                params: event.query.parameters,
            }, `Query failed in ${event.queryDurationMillis.toFixed(2)}ms`);
        } else { // 'query'
            logger.trace({
                sql: event.query.sql,
                params: event.query.parameters,
            }, `Query executed in ${event.queryDurationMillis.toFixed(2)}ms`);
        }
    }
});

await sql`PRAGMA journal_mode = WAL`.execute(db)
