import { LEVELS, LEVEL_NAMES } from '../constants';

/**
 * Given initial settings for custom levels/names and use of only custom props
 * get the level label that corresponds with a given level number
 *
 * @param {boolean} useOnlyCustomProps
 * @param {object} customLevels
 * @param {object} customLevelNames
 *
 * @returns {function} A function that takes a number level and returns the level's label string
 */
export default function getLevelLabelData(
    useOnlyCustomProps: boolean,
    customLevels: object,
    customLevelNames: object,
): (level: string | number) => [string, string | number] { 
    const levels = (useOnlyCustomProps ? customLevels || LEVELS : Object.assign({}, LEVELS, customLevels)) as Record<string | number, string>;
    const levelNames = (useOnlyCustomProps
        ? customLevelNames || LEVEL_NAMES
        : Object.assign({}, LEVEL_NAMES, customLevelNames)) as Record<string | number, string>;
    return (level) => {
        let levelNum: string | number = 'default';
        if (Number.isInteger(+level)) {
            levelNum = Object.prototype.hasOwnProperty.call(levels, level) ? level : levelNum;
        } else {
            levelNum = Object.prototype.hasOwnProperty.call(levelNames, (level as string).toLowerCase())
                ? levelNames[(level as string).toLowerCase()]
                : levelNum;
        }

        return [levels[levelNum], levelNum];
    };
}
