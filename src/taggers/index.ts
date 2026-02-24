import { CamieMatcher } from "./camie-v2/index.js";
import { Matcher } from "./matcher.js";

export const matchers: Matcher[] = [
    new CamieMatcher(),
];
