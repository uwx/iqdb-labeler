// import { DeepDanbooruMatcher } from "./deep-danbooru/index.js";
import { HuggingFaceMatcher } from "./huggingface-wd-tagger/index.js";
import { IqdbMatcher } from "./iqdb/index.js";
import { Matcher } from "./matcher.js";
import { WDv3Matcher } from "./wd-vit-v3/index.js";

export const matchers: Matcher[] = [
    new WDv3Matcher(),
    // new IqdbMatcher(),
    // new HuggingFaceMatcher(),
    // new DeepDanbooruMatcher()
];
