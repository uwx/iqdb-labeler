import joinLinesWithIndentation from './join-lines-with-indentation'

interface PrettifyErrorParams {
  /** The key assigned to this error in the log object. */
  keyName: string;
  /** The STRINGIFIED error. If the error field has a custom prettifier, that should be pre-applied as well. */
  lines: string;
  /** The indentation sequence to use. */
  ident: string;
  /** The EOL sequence to use. */
  eol: string;
}

/**
 * Prettifies an error string into a multi-line format.
 *
 * @param {PrettifyErrorParams} input
 *
 * @returns {string}
 */
export default function prettifyError ({ keyName, lines, eol, ident }: PrettifyErrorParams): string {
  let result = ''
  const joinedLines = joinLinesWithIndentation({ input: lines, ident, eol })
  const splitLines = `${ident}${keyName}: ${joinedLines}${eol}`.split(eol)

  for (let j = 0; j < splitLines.length; j += 1) {
    if (j !== 0) result += eol

    const line = splitLines[j]
    if (/^\s*"stack"/.test(line)) {
      const matches = /^(\s*"stack":)\s*(".*"),?$/.exec(line)
      /* istanbul ignore else */
      if (matches && matches.length === 3) {
        const indentSize = /^\s*/.exec(line)[0].length + 4
        const indentation = ' '.repeat(indentSize)
        const stackMessage = matches[2]
        result += matches[1] + eol + indentation + JSON.parse(stackMessage).replace(/\n/g, eol + indentation)
      } else {
        result += line
      }
    } else {
      result += line
    }
  }

  return result
}
