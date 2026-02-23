export default function isObject(input: unknown): input is object {
    return Object.prototype.toString.apply(input) === '[object Object]';
}
