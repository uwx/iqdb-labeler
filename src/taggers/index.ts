import { IqdbMatcher } from "./iqdb.js";
import { Matcher } from "./matcher.js";

export const matchers: Matcher[] = [
    new IqdbMatcher()
];
