import http from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import type { SessionRecord } from './sessions.js';

const HOP_BY_HOP_REQUEST = new Set(['host', 'connection', 'cookie', 'set-cookie', 'accept-encoding']);

const HOP_BY_HOP_RESPONSE = new Set([
  'connection',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'set-cookie',
  'content-encoding',
]);

function notesBase(): string {
  return config.notesUrl.endsWith('/') ? config.notesUrl : config.notesUrl + '/';
}

export function proxyToNotes(
  request: FastifyRequest,
  reply: FastifyReply,
  session: SessionRecord | null = null
): void {
  reply.hijack();

  const target = new URL(request.url, notesBase());

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP_REQUEST.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  if (session) {
    headers.Authorization = `Bearer ${session.session.token}`;
  }

  let body: Buffer | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.body !== undefined && request.body !== null) {
      body = Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
      headers['content-length'] = String(body.length);
    }
  }

  const proxyReq = http.request(target, { method: request.method, headers }, (proxyRes) => {
    const responseHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value === undefined) continue;
      if (HOP_BY_HOP_RESPONSE.has(key.toLowerCase())) continue;
      responseHeaders[key] = value;
    }

    reply.raw.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
    proxyRes.pipe(reply.raw);
  });

  proxyReq.on('error', (err) => {
    request.log.warn({ err }, 'proxy request failed');
    if (!reply.raw.headersSent) {
      reply.raw.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      reply.raw.end(JSON.stringify({ error: 'Could not reach the notes server' }));
    } else {
      reply.raw.end();
    }
  });

  if (body) {
    proxyReq.write(body);
    proxyReq.end();
  } else {
    request.raw.pipe(proxyReq);
  }
}
