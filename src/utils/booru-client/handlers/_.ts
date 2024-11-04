import { XMLParser } from "fast-xml-parser";

const xmlOptions = {
    attributeNamePrefix: "",
    ignoreAttributes: false,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: false,
    decodeHTMLchar: false,
    cdataTagName: "__cdata",
    cdataPositionChar: "\\c",
};

export default class BaseHandler {
    async get(url: string, options?: baseGetOptions): Promise<unknown> {
        if (!url) throw new Error('No url supplied...');

        const headersInit: RequestInit = options?.userAgent ? { headers: { "User-Agent": options.userAgent } } : {};

        const xml = options?.xml ?? false;

        const response = await fetch(url, headersInit);

        if (response.status !== 200) throw new Error(`${response.status}: ${response.statusText}`);
        return xml
            ? new XMLParser(xmlOptions).parse(await response.text())
            : await response.json();
    }
}
type baseGetOptions = {
    userAgent?: string,
    xml?: boolean,
}
