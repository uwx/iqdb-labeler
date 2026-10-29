import * as id128 from 'id128';

const Ulid = id128.Ulid;

export function ulid(array: ArrayBuffer | Uint8Array): id128.Ulid;
export function ulid(option?: { time?: Date | number | null }): id128.Ulid;
export function ulid(optionOrArray?: ArrayBuffer | Uint8Array | { time?: Date | number | null }): id128.Ulid {
    if (!optionOrArray || (!(optionOrArray instanceof ArrayBuffer) && !(optionOrArray instanceof Uint8Array)))
        return Ulid.generate(optionOrArray);

    return Ulid.construct(new Uint8Array(optionOrArray));
}

export const ulidZero = ulid({ time: 0 });
