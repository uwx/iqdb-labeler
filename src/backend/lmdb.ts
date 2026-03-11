import { DB_PATH } from '../config.js';
import { SqliteWrapper } from '../utils/nodesqlite-wrapper.js';

export const db = new SqliteWrapper(DB_PATH);
