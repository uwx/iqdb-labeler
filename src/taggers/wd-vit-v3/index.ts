import path from 'node:path';
import { spawn } from 'promisify-child-process'

import logger from '../../backend/logger.js';
import { Match, Matcher } from '../matcher.js';
import { getTag } from '../../labels/index.js';
import { ulid } from '../../utils/ulid.js';

const AUTH_KEY = ulid().toCanonical(); // probably could be better

const deepDanbooruProcess = spawn(
    path.join(process.cwd(), 'extern/wdv3-timm', '.venv', 'Scripts', 'python.exe'), ['wdv3_timm_server.py'],
    {
        cwd: path.join(process.cwd(), 'extern/wdv3-timm'),
        encoding: 'utf-8',
        env: {
            ...process.env,
            THRESHOLD: '0.5',
            AUTH_KEY: AUTH_KEY,
        }
    });

deepDanbooruProcess.stdout?.on('data', data => {
    for (const line of data.toString('utf-8').split('\n')) {
        logger.info('[WDV3] ' + line);
    }
});

deepDanbooruProcess.stderr?.on('data', data => {
    for (const line of data.toString('utf-8').split('\n')) {
        logger.error('[WDV3] ' + line);
    }
});

deepDanbooruProcess.on('close', (code) => {
  if (code !== 0) {
    logger.debug(`WDV3 process exited with code ${code}`);
  }
});

process.on('beforeExit', () => {
    deepDanbooruProcess.kill();
});

export class WDv3Matcher extends Matcher {
    async getMatchImpl(imageUrl: string) {
        const blob = await fetch(imageUrl).then(e => e.blob());

        const formData = new FormData();
        formData.append('file', new File([blob], path.basename(imageUrl)));

        const resultString = (await fetch('http://127.0.0.1:12152', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${AUTH_KEY}`
            }
        }).then(e => e.text())) as string;

        logger.debug(`[WDV3] RESULT: ${resultString}`);

        const result = JSON.parse(resultString);

        const tags: number[] = [];
        for (const tag of result) {
            const theTag = await getTag(tag);
            if (theTag) tags.push(theTag.id);
        }

        if (tags.length > 0) {
            return { tags, similarity: 0.75 } satisfies Match;
        }
    }
}
