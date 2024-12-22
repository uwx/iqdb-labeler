import { db } from "../backend/db.js";
import { config } from "../utils/configs.js";

const trackedUsers = await config.get('trackedUsers') ?? {followers: [], likers: []};

const likers = await db.selectFrom('Liker').selectAll().execute();
const followers = await db.selectFrom('Follower').selectAll().execute();

trackedUsers.followers.push(...followers);
trackedUsers.likers.push(...likers);

await config.set('trackedUsers', trackedUsers);

