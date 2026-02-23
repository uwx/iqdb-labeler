import type { CallSiteObject } from "node:util";

export function formatTimeSpan(diff: number) {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * (1000 * 60 * 60 * 24);

    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);

    const mins = Math.floor(diff / (1000 * 60));
    diff -= mins * (1000 * 60);

    const seconds = Math.floor(diff / 1000);
    diff -= seconds * 1000;

    const millis = diff;

    if (days > 0) return `+${days}d ${hours}h ${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    if (hours > 0) return `+${hours}h ${mins}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    if (mins > 0) return `+${mins}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    return `+${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

export function formatCaller(caller: CallSiteObject & { path: string }): string {
    return `${caller.path}#${caller.functionName || '<anonymous>'}:${caller.lineNumber}:${caller.columnNumber}`;
}