export async function arrayFromAsync<T>(generator: AsyncIterable<T> | AsyncGenerator<T>): Promise<T[]> {
    const arr: T[] = [];
    for await (const entry of generator) {
        arr.push(entry);
    }
    return arr;
}
