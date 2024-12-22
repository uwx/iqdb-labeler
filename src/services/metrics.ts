import { Registry, collectDefaultMetrics } from 'prom-client';
import fastifyPlugin from 'fastify-plugin';
import { Hono } from 'hono';

const register = new Registry();
collectDefaultMetrics({ register });

export default function(app: Hono) {
    app.get('/metrics', async (c) => {
        const metrics = await register.metrics();
        c.header('Content-Type', register.contentType);
        return c.text(metrics);
    });
}
