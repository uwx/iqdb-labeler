import { getDbConfigItem, setDbConfigItem } from './db-config.ts';

/**
 * The appview silently drops labels beyond 5/s, 5000/hour and 50000/day per
 * labeler, so emitting more than that just loses data. This holds emission to a
 * share of that budget.
 */
const PER_SECOND = 4;
const PER_HOUR = 4500;
const PER_DAY = 45000;

type Bucket = { day: string; dayCount: number; hour: number; hourCount: number; second: number; secondCount: number };

const CONFIG_KEY = 'labelBudget' as const;

let bucket: Bucket = { day: '', dayCount: 0, hour: 0, hourCount: 0, second: 0, secondCount: 0 };

function roll(now: number): Bucket {
    const day = new Date(now).toISOString().slice(0, 10);
    const hour = Math.floor(now / 3_600_000);
    const second = Math.floor(now / 1_000);

    if (bucket.day !== day) {
        return { day, dayCount: 0, hour, hourCount: 0, second, secondCount: 0 };
    }
    if (bucket.hour !== hour) {
        return { ...bucket, hour, hourCount: 0, second, secondCount: 0 };
    }
    if (bucket.second !== second) {
        return { ...bucket, second, secondCount: 0 };
    }
    return bucket;
}

/**
 * Reserve up to `wanted` label slots. Returns how many may be emitted now.
 */
export async function reserveLabelBudget(wanted: number): Promise<number> {
    const fresh = bucket.day !== new Date().toISOString().slice(0, 10);
    bucket = roll(Date.now());

    if (fresh) {
        const saved = await getDbConfigItem(CONFIG_KEY).catch(() => null);
        if (saved?.day === bucket.day) {
            bucket.dayCount = saved.count;
        }
    }

    const allowed = Math.max(
        0,
        Math.min(wanted, PER_SECOND - bucket.secondCount, PER_HOUR - bucket.hourCount, PER_DAY - bucket.dayCount),
    );
    if (allowed === 0) {
        return 0;
    }

    bucket.secondCount += allowed;
    bucket.hourCount += allowed;
    bucket.dayCount += allowed;

    // persist the daily counter so a restart doesn't reset the budget
    await setDbConfigItem(CONFIG_KEY, { day: bucket.day, count: bucket.dayCount }).catch(() => undefined);

    return allowed;
}
