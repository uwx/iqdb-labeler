// import { CamieMatcher } from "./camie-v2/index.js";
import { Matcher } from './matcher.js';
import { WdMatcher } from './wd-swinv2-tagger-v3/index.js';

export const matchers: Matcher[] = [
    new WdMatcher(),
    // new CamieMatcher(),
];
