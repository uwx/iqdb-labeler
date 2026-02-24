declare module '@atcute/xrpc-server-node' {
    import type { Server } from 'node:http';
    import type { Http2SecureServer, Http2Server } from 'node:http2';
    import type { WebSocketAdapter, XRPCRouter } from '@atcute/xrpc-server';
    import { WebSocketServer } from 'ws';
    export interface NodeWebSocket {
        adapter: WebSocketAdapter;
        wss: WebSocketServer;
        injectWebSocket(server: Server | Http2Server | Http2SecureServer, router: XRPCRouter): void;
    }
    export const createNodeWebSocket: () => NodeWebSocket;
}

declare module '*.csv?raw' {
    const content: string;
    export default content;
}
