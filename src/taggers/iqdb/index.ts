import { getTag } from '../../labels/index.js';
import { IQDBLibs_2D } from './iqdb-client/src/h.js';
import { makeSearchFunc } from './iqdb-client/src/index.js';
import { Match, Matcher, MatchError, Rating } from '../matcher.js';
import Danbooru from '../../utils/booru-client/clients/danbooru.js';

const USER_AGENT = 'bsky-iqdb-labeler/1.0.0';

const searchPic = makeSearchFunc({
    baseDomain: 'iqdb.org',
    similarityPass: 0.8,
    userAgent: USER_AGENT,
});

function extractDanbooruPostId(url: string) {
    return url.match(/danbooru\.donmai\.us\/posts\/(\d+)/i)?.[1];
}

export class IqdbMatcher extends Matcher {
    async getMatchImpl(imageUrl: string) {
        const result = await searchPic(imageUrl, {
            lib: 'www',
            service: [
                IQDBLibs_2D.danbooru,
                IQDBLibs_2D.konachan,
                IQDBLibs_2D['yande.re'],
                IQDBLibs_2D.gelbooru,
                IQDBLibs_2D['sankaku channel'],
                IQDBLibs_2D['e-shuushuu'],
                IQDBLibs_2D.zerochan,
                IQDBLibs_2D['anime-picture'],
            ]
        });

        if (result.ok) {
            const bestMatches = result.data
                .filter(e => e.head != 'Your image')
                .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

            const danbooruMatch = bestMatches.find(e => e.sourceUrl?.includes('danbooru.donmai.us'));
            if (danbooruMatch) {
                const postId = extractDanbooruPostId(danbooruMatch.sourceUrl!)
                const post = await new Danbooru().getPost(Number(postId!), { fullpost: true });

                const tags: number[] = [];
                for (const tag of post.tag_string.split(' ')) {
                    const theTag = await getTag(tag);
                    if (theTag !== undefined) {
                        tags.push(theTag.id);
                    }
                }

                return {
                    similarity: danbooruMatch.similarity ?? 0.1,

                    md5: post.md5,
                    rating: post.rating as unknown as Rating,
                    sourceUrl: post.source,
                    pixivId: post.pixiv_id,
                    fileSize: post.file_size,
                    tags
                } satisfies Match;
            }
        } else if ('err' in result) {
            return { error: result.err ?? 'Unknown error' } satisfies MatchError;
        }
    }
}
