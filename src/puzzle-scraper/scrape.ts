import logger from "../backend/logger.js";
import { addEntry, IdPostEntry, riDb, Service } from "./database.js";
import * as clients from "../utils/booru-client/index.js";
import { USER_AGENT as E6_USER_AGENT } from "../utils/booru-client/clients/e621.js";

const scrapers = [
    ['danbooruv3', new clients.Danbooru(), (id: number, md5?: string) => new IdPostEntry(id, Service.Danbooru, md5), Service.Danbooru],
    ['e6v3', new clients.E621(), (id: number, md5?: string) => new IdPostEntry(id, Service.E621, md5), Service.E621],
    ['Konachan', new clients.Konachan(), (id: number, md5?: string) => new IdPostEntry(id, Service.Konachan, md5), Service.Konachan],
    ['Rule34', new clients.Rule34(), (id: number, md5?: string) => new IdPostEntry(id, Service.Rule34, md5), Service.Rule34],
    ['Yandere', new clients.Yandere(), (id: number, md5?: string) => new IdPostEntry(id, Service.Yandere, md5), Service.Yandere],
    ['Gelbooru', new clients.Gelbooru(), (id: number, md5?: string) => new IdPostEntry(id, Service.Gelbooru, md5), Service.Gelbooru],
] as const;

async function getScrapeCursor(scraperName: string) {
    return (
        await riDb
            .selectFrom('Cursor')
            .where('serviceName', '==', scraperName)
            .select('cursorId')
            .executeTakeFirst()
    )?.cursorId;
}

async function updateCursor(scraperName: string, cursorId: number) {
    await riDb
        .insertInto('Cursor')
        .values({
            serviceName: scraperName,
            cursorId
        })
        .onConflict(oc => oc.column('serviceName').doUpdateSet({
            cursorId
        }))
        .execute();
}

async function hasEntryWithKey([service, id]: [service: Service, id: number]) {
    return (
        await riDb
            .selectFrom('Hash')
            .where(eb => eb.and([
                eb('service', '==', service),
                eb('id', '==', id),
            ]))
            .limit(2)
            .execute()
    ).length == 2; // 2 hash kinds
}

async function addPostEntry([service, id]: [service: Service, id: number], post: {
    id: number;
    missing?: false;
    deleted?: false;
    image: string[];
    thumbnail_image: string[];
    rating: "g" | "s" | "q" | "e";
    tags: string[];
    artist: string[];
    source: string[];
    created_at: string;
    ext: string;
    md5?: string;
    sha1?: string;
}) {
    await riDb
        .insertInto('Post')
        .values({
            service: service,
            id: id,

            missing: 0,
            deleted: 0,
        
            image: JSON.stringify(post.image),
            thumbnailImage: JSON.stringify(post.thumbnail_image),
            rating: post.rating,
            tags: JSON.stringify(post.tags),
            artist: JSON.stringify(post.artist),
            source: JSON.stringify(post.source),
            createdAt: post.created_at,
            ext: post.ext,
        
            md5: post.md5,
            sha1: post.sha1,
        })
        .onConflict(oc => oc.doNothing())
        .execute();
}

async function addErrorEntry([service, id]: [service: Service, id: number], message: string) {
    await riDb
        .insertInto('PostError')
        .values({
            id: id,
            service: service,
            error: message,
        })
        .onConflict(oc => oc.column('id').doUpdateSet({
            service: service,
            error: message,
        }))
        .execute();
}

const validExts = new Set(['png', 'apng', 'webp', 'jpg', 'jpeg', 'gif', 'bmp']);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const checkExisting = true;

const scraperPromise: Promise<unknown>[] = [];

for (const [scraperName, scraper, postEntryCtor, svc] of scrapers) {
    scraperPromise.push((async () => {
        while (true) {
            const startId = await getScrapeCursor(scraperName) ?? 0;

            console.time(`${scraperName} #${startId}`);

            logger.info(`Scraping ${scraperName} from #${startId}`);

            const posts = await scraper.search(startId);

            if (posts.length === 0) {
                logger.info(`${scraperName} is done! Final ID: ${startId}`);
                return startId;
            }

            mast:
            for (const post of posts) {
                const postKey = [svc, post.id] satisfies [service: Service, id: number];

                if (checkExisting) {
                    if (await hasEntryWithKey(postKey)) {
                        logger.warn(`${scraperName} ${post.id}: already scraped`);
                        continue;
                    }
                }

                logger.info(`Got ${scraperName} #${post.id}`);

                if ('missing' in post && post.missing) {
                    logger.warn(`${scraperName} ${post.id}: post missing`);
                    continue;
                }

                if ('deleted' in post && post.deleted) {
                    logger.warn(`${scraperName} ${post.id}: post deleted`);
                    continue;
                }

                await addPostEntry(postKey, post);

                if (!post.thumbnail_image.length) {
                    logger.error(post, `${scraperName} ${post.id}: no post.thumbnail_image`);
                    continue;
                }

                if (!validExts.has(post.ext!.toLowerCase())) {
                    logger.info(post, `#${post.id} invalid ext: ${post.ext}`);
                    continue;
                }

                let buf: ArrayBuffer | undefined = undefined;

                opts:
                for (const thumbnailImageOption of post.thumbnail_image) {
                    let retry = false;

                    retrying:
                    do {
                        try {
                            logger.debug(`${scraperName} #${post.id} trying ${thumbnailImageOption}`);
                            const response = await fetch(thumbnailImageOption, { headers: { 'User-Agent': E6_USER_AGENT }});
                            if (!response.ok) {
                                if (response.status === 404) {
                                    logger.error(`#${post.id} ${thumbnailImageOption} 404'd`);
                                    continue opts;
                                }

                                throw new Error(`#${post.id} ${thumbnailImageOption} ${response.status}: ${response.statusText}`);
                            }

                            buf = await response.arrayBuffer();

                            if (buf !== undefined && buf.byteLength > 0) { // rule34.xxx sometimes returns images with length 0
                                break opts;
                            }
                        } catch (err) {
                            if (err instanceof TypeError && err.message === 'fetch failed') { // usually ECONNRESET
                                retry = true;
                                await delay(1000);
                                continue retrying;
                            } else {
                                throw err;
                            }
                        }
                    } while (retry);
                }

                if (buf === undefined) {
                    logger.error(post, `no ${scraperName} #${post.id} thumbnail options worked!`);
                    await addErrorEntry(postKey, `404 for thumbnails ${post.thumbnail_image.join(', ')}`);
                    continue;
                }

                try {
                    const [key, ] = await addEntry(buf, postEntryCtor(post.id, post.md5));
                    logger.info(`Added entry as ID ${key}`);
                } catch (err) {
                    logger.error({post, err}, `While processsing post #${post.id}`);
                    await addErrorEntry(postKey, ''+err);
                    // throw err;
                }
            }

            await updateCursor(scraperName, Math.max(...posts.map(e => e.id)));

            console.timeEnd(`${scraperName} #${startId}`);
        }
    })());
}

await Promise.all(scraperPromise);

