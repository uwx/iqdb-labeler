interface JoinLinesWithIndentationParams {
    /** The string to split and reformat. */
    input: string;
    /** The indentation string. Default: `    ` (4 spaces). */
    ident?: string;
    /** The end of line sequence to use when rejoining the lines. Default: `'\n'`. */
    eol?: string;
}

/**
 * Given a string with line separators, either `\r\n` or `\n`, add indentation
 * to all lines subsequent to the first line and rejoin the lines using an
 * end of line sequence.
 *
 * @param {JoinLinesWithIndentationParams} input
 *
 * @returns {string} A string with lines subsequent to the first indented
 * with the given indentation sequence.
 */
export default function joinLinesWithIndentation({
    input,
    ident = '    ',
    eol = '\n',
}: JoinLinesWithIndentationParams): string {
    const lines = input.split(/\r?\n/);
    for (let i = 1; i < lines.length; i += 1) {
        lines[i] = ident + lines[i];
    }
    return lines.join(eol);
}
