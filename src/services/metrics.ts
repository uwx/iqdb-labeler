import { Registry, collectDefaultMetrics } from 'prom-client';
import fastifyPlugin from 'fastify-plugin';

const register = new Registry();
collectDefaultMetrics({ register });

export default fastifyPlugin((app, options, done) => {
    app.get('/metrics', async (req, res) => {
        const metrics = await register.metrics();
        res.header('Content-Type', register.contentType);
        res.send(metrics);
    });

    done();
});
