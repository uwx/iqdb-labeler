import { defineConfig } from 'rolldown';

export default defineConfig({
    input: {
        client: 'src/labeler-client.ts',
        server: 'src/labeler-server.ts',
        'publish-feeds': 'src/tools/publish-feeds.ts',
    },
    platform: 'node',
    external: [
        'node:*', 'sharp', 'kysely', 'onnxruntime-node', 'ws', 'ngrok', 'cloudflared'
    ],
    output: {
        dir: 'out',
        sourcemap: 'inline'
    },
});
