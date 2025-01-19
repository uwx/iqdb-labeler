import path from "node:path";
import logger from "../../backend/logger.js";
import { getTag } from "../../labels/index.js";
import { Matcher, type Match } from "../matcher.js";
import { analyze } from "./inference.js";

export class WDv3OnnxMatcher extends Matcher {
    async getMatchImpl(imageUrl: string) {
        const buffer = await fetch(imageUrl).then(e => e.arrayBuffer());

        const result = await analyze(buffer);

        const tags: number[] = [];
        for (const [tag, prob] of result) {
            const theTag = await getTag(tag);
            if (theTag) tags.push(theTag.id);
        }

        if (tags.length > 0) {
            return { tags, similarity: 0.75 } satisfies Match;
        }
    }
}

// const buffer = await fetch('https://cdn.donmai.us/sample/82/a6/__nilou_genshin_impact_drawn_by_kippeijii__sample-82a6e25f544a0c58420381a5e75002ca.jpg')
//     .then(e => e.arrayBuffer());
