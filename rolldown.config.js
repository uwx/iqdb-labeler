import { defineConfig } from 'rolldown';

export default defineConfig({
    input: {
        client: 'src/labeler-client.ts',
        server: 'src/labeler-server.ts',
        'publish-feeds': 'src/tools/publish-feeds.ts',
        'set-labels': 'src/tools/set-labels.ts',
        'danbooru-query': 'src/tools/danbooru-query.ts',
        'any-tunnel': 'src/tools/any-tunnel.ts'
    },
    treeshake: true,
    platform: 'node',
    external: [
        'node:*', 'sharp', 'kysely', 'onnxruntime-node', 'ws', 'ngrok', 'cloudflared'
    ],
    output: {
        dir: 'out',
        sourcemap: 'inline',
        chunkFileNames: 'vendor/[name].js',
        preserveModules: true,
        preserveModulesRoot: '.',
    },
});
