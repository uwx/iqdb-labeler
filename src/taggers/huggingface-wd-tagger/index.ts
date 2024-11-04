import { Client } from "@gradio/client";
import { Match, Matcher, MatchError } from "../matcher.js";
import { tagsByNameOrAlias } from "../../labels/index.js";

export const enum Models {
    'SmilingWolf/wd-swinv2-tagger-v3' = 'SmilingWolf/wd-swinv2-tagger-v3',
    'SmilingWolf/wd-v1-4-swinv2-tagger-v2' = 'SmilingWolf/wd-v1-4-swinv2-tagger-v2',
    'SmilingWolf/wd-v1-4-vit-tagger' = 'SmilingWolf/wd-v1-4-vit-tagger',
    'SmilingWolf/wd-v1-4-vit-tagger-v2' = 'SmilingWolf/wd-v1-4-vit-tagger-v2',
    'SmilingWolf/wd-v1-4-convnext-tagger' = 'SmilingWolf/wd-v1-4-convnext-tagger',
    'SmilingWolf/wd-v1-4-convnext-tagger-v2' = 'SmilingWolf/wd-v1-4-convnext-tagger-v2',
    'SmilingWolf/wd-convnext-tagger-v3' = 'SmilingWolf/wd-convnext-tagger-v3',
}

interface ConfidenceRating {
    label: string;
    confidences: Array<{ label: string, confidence: number }>;
}

type HFResult = [
    tagString: string,
    rating: ConfidenceRating,
    characters: ConfidenceRating,
    tags: ConfidenceRating,
];

export class HuggingFaceMatcher extends Matcher {
    constructor(
        private readonly model: Models = Models["SmilingWolf/wd-convnext-tagger-v3"],
        private readonly general_thresh = 0.35,
        private readonly general_mcut_enabled = false,
        private readonly character_thresh = 0.85,
        private readonly character_mcut_enabled = false,
    ) {
        super();
    }

    async getMatchImpl(imageUrl: string): Promise<Match | MatchError | void> {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            return {
                error: `Could not fetch imageUrl: ${imageUrl}, ${response.status}: ${response.statusText}`
            };
        }

        const image = await response.blob();

        const client = await Client.connect("SmilingWolf/wd-tagger");
        const result = await client.predict("/predict", {
            image,
            model_repo: this.model,
            general_thresh: this.general_thresh,
            general_mcut_enabled: this.general_mcut_enabled,
            character_thresh: this.character_thresh,
            character_mcut_enabled: this.character_mcut_enabled,
        });

        const [tagString, { label: rating }, { confidences: characterConfidences }, { confidences: tagConfidences }] = result.data as HFResult;

        const tags = tagString
            .split(', ')
            // convert stable diffusion tag to danbooru tag
            .map(e => tagsByNameOrAlias.get(e.trim().replace(/\\/g, '').replace(/ /g, '_')))
            .filter(e => e !== undefined);

        // if (rating) tags.push(tagsByNameOrAlias.get('rating:' + rating[0]));

        if (tags.length) {
            return {
                similarity: Math.max(...tagConfidences.map(e => e.confidence)),
                tags,
            } satisfies Match;
        }
    }
}

await new HuggingFaceMatcher().getMatchImpl('https://cdn.donmai.us/sample/00/f5/__suzumiya_haruhi_suzumiya_haruhi_no_yuuutsu_drawn_by_megu_9abgoluanvcjd7o__sample-00f520c248abe1d3d9e813184830a2b1.jpg')