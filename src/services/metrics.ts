import { Registry, collectDefaultMetrics } from 'prom-client';
import { Hono } from 'hono';

const register = new Registry();
collectDefaultMetrics({ register });

export default function plugin(hono: Hono) {
    hono.get('/metrics', async (c) => {
        const metrics = await register.metrics();
        c.header('Content-Type', register.contentType);
        c.text(metrics);
    });
}
