import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { getSession } from './sessions.js';
import { registerAuth } from './auth.js';
import { proxyToNotes } from './proxy.js';
import { registerNotesStream, registerShiftsStream } from './stream.js';

const app = Fastify({ logger: true });

await app.register(cookie);

await registerAuth(app);
await registerNotesStream(app);
await registerShiftsStream(app);

app.get('/health', (request, reply) => {
  proxyToNotes(request, reply);
});

app.all('/api/*', (request, reply) => {
  const session = getSession(request.cookies.session);
  if (!session) {
    return reply.code(401).send({ error: 'Not authenticated' });
  }
  proxyToNotes(request, reply, session);
  return reply;
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');

if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api') || request.url === '/health') {
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
