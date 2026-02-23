import type pino from "pino";
import { WebSocketServer, type WebSocket } from 'ws';

export default function wsStream(): pino.DestinationStream & { terminate: () => void } {
    const wss = new WebSocketServer({ port: 6970 });

    const clients = new Set<WebSocket>();

    wss.on('connection', function connection(ws) {
        console.log('new connection!');
        clients.add(ws);

        ws.on('close', () => {
            clients.delete(ws);
        });
    });
    
    return {
        write(msg) {
            for (const client of clients) {
                client.send(msg);
            }
        },
        terminate() {
            wss.close();
        },
    }
}