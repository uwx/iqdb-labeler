import path from 'node:path';
import { spawn } from 'promisify-child-process'
import { ulid } from 'ulid';
import logger from '../../logger.js';
import { Match, Matcher } from '../matcher.js';
import { tagsByNameOrAlias } from '../../labels/index.js';

const AUTH_KEY = ulid(); // probably could be better

const pythonExe = process.env.PYTHON_EXECUTABLE!.split(' ');
const deepDanbooruProcess = spawn(pythonExe[0], [...pythonExe.slice(1), 'test.py'], {
    cwd: path.join(process.cwd(), 'extern/TorchDeepDanbooru'),
    encoding: 'utf-8',
    env: {
        ...process.env,
        THRESHOLD: '0.5',
        AUTH_KEY,
    }
});

deepDanbooruProcess.stdout?.on('data', data => {
    for (const line of data.toString('utf-8').split('\n')) {
        logger.info('[DeepDanbooru] ' + line);
    }
});

deepDanbooruProcess.stderr?.on('data', data => {
    for (const line of data.toString('utf-8').split('\n')) {
        logger.error('[DeepDanbooru] ' + line);
    }
});

deepDanbooruProcess.on('close', (code) => {
  if (code !== 0) {
    logger.debug(`DeepDanbooru process exited with code ${code}`);
  }
});

process.on('beforeExit', () => {
    deepDanbooruProcess.kill();
});

export class DeepDanbooruMatcher extends Matcher {
    async getMatch(imageUrl: string) {
        const blob = await fetch(imageUrl).then(e => e.blob());

        const formData = new FormData();
        formData.append('file', new File([blob], path.basename(imageUrl)));

        const result = (await fetch('http://127.0.0.1:12151', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${AUTH_KEY}`
            }
        }).then(e => e.json())) as [tag: string, p: number][];

        const tags: number[] = [];
        for (const [tag, p] of result) {
            const tagId = tagsByNameOrAlias.get(tag);
            if (tagId !== undefined) {
                tags.push(tagId);
            }
        }

        if (tags.length > 0) {
            return { similarity: 0.5, tags } satisfies Match;
        }
    }
}