/**
 * Checks if the argument is a JS Date and not 'Invalid Date'.
 *
 * @param {Date} date The date to check.
 *
 * @returns {boolean} true if the argument is a JS Date and not 'Invalid Date'.
 */
export default function isValidDate(date: Date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}
