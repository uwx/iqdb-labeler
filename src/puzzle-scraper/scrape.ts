import logger from "../logger.js";
import { addEntry, cursors, DanbooruPostEntry, E6PostEntry, posts as postsDb } from "./database.js";
import Danbooru from "./scrapers/client/danbooru.js";
import E621, { USER_AGENT as E6_USER_AGENT } from "./scrapers/client/e621.js";

const scrapers = [['danbooruv3', new Danbooru(), DanbooruPostEntry], ['e6v3', new E621(), E6PostEntry]] as const;

const validExts = new Set(['png', 'apng', 'webp', 'jpg', 'jpeg', 'gif', 'bmp']);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

while (true) {
    const p: Promise<unknown>[] = [];

    for (const [scraperName, scraper, postEntryCtor] of scrapers) {
        p.push((async () => {
            const startId = cursors.get(scraperName) ?? 0;

            console.time(`${scraperName} #${startId}`);

            logger.info(`Scraping ${scraperName} from #${startId}`);

            const posts = await scraper.search(startId);
            for (const post of posts) {
                logger.info(`Got ${scraperName} #${post.id}`);
                await postsDb.put([post.id, scraperName], post);

                if (!post.thumbnail_image) {
                    logger.warn(`${scraperName} ${post.id}: no post.thumbnail_image`);
                    continue;
                }

                if (!validExts.has(post.ext!.toLowerCase())) {
                    logger.info(`#${post.id} invalid ext: ${post.ext}`);
                    continue;
                }

                let buf: ArrayBuffer;

                let retry = false;
                do {
                    try {
                        const response = await fetch(post.thumbnail_image, { headers: { 'User-Agent': E6_USER_AGENT }});
                        if (!response.ok) {
                            if (response.status === 404) {
                                logger.error(`#${post.id} 404'd`);
                                continue;
                            }
                            throw new Error(`${response.status}: ${response.statusText}`);
                        }

                        buf = await response.arrayBuffer();
                    } catch (err) {
                        if (err instanceof TypeError && err.message === 'fetch failed') { // usually ECONNRESET
                            retry = true;
                            await delay(1000);
                            continue;
                        }
                    }
                } while (retry);

                try {
                    const entry = await addEntry(buf!, new postEntryCtor(post.id, post.md5));
                    logger.info(`Added entry as ID ${entry}`);
                } catch (err) {
                    logger.error(`While processsing post #${post.id}`);
                    console.error(post);
                    console.error(err);
                    throw err;
                }
            }

            await cursors.put(scraperName, Math.max(...posts.map(e => e.id)));

            console.timeEnd(`${scraperName} #${startId}`);
        })());
    }

    await Promise.all(p);
}