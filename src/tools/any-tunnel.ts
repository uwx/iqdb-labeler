import { setupTunnel } from './util/setup-tunnel.js';
import { FEEDS_DOMAIN } from '../config.js';

await setupTunnel(process.argv[2] || `https://${FEEDS_DOMAIN}`);
