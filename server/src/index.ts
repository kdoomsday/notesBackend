import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { proxyToNotes } from './proxy.js';

const app = Fastify({ logger: true });

app.all('/health', (request, reply) => {
  proxyToNotes(request, reply);
  return reply;
});

app.all('/apk', (request, reply) => {
  proxyToNotes(request, reply);
  return reply;
});

app.all('/api/*', (request, reply) => {
  proxyToNotes(request, reply);
  return reply;
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');

if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api') || request.url === '/health' || request.url === '/apk') {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}