import { defineConfig } from 'rolldown';
import { readFileSync } from 'fs';

const raw = () => {
    return {
        name: 'raw',
        load(id) {
            if (id.endsWith('?raw')) {
                const content = readFileSync(id.replace('?raw', '')).toString('utf-8');
                return `export default ${JSON.stringify(content)};`;
            }
        }
    };
};

export default defineConfig({
    input: {
        client: 'src/labeler-client.ts',
        server: 'src/labeler-server.ts',
        'publish-feeds': 'src/tools/publish-feeds.ts',
        'set-labels': 'src/tools/set-labels.ts',
        'danbooru-query': 'src/tools/danbooru-query.ts',
        'any-tunnel': 'src/tools/any-tunnel.ts',
        'declare-labeler': 'src/tools/declare-labeler.ts',
    },
    treeshake: true,
    platform: 'node',
    external: [
        'node:*', 'sharp', 'kysely', 'onnxruntime-node', 'ws', 'ngrok', 'cloudflared', 'msgpackr-extract'
    ],
    output: {
        dir: 'out',
        sourcemap: 'inline',
        chunkFileNames: 'vendor/[name].js',
        preserveModules: true,
        preserveModulesRoot: '.',
    },
    plugins: [raw()],
});
