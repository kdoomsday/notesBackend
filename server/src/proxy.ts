import http from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { deleteSession, type SessionRecord } from './sessions.js';

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

  const proxyReq = http.request(target, { method: request.method, headers }, (proxyRes) => {
    const responseHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value === undefined) continue;
      if (HOP_BY_HOP_RESPONSE.has(key.toLowerCase())) continue;
      responseHeaders[key] = value;
    }
    if (proxyRes.statusCode === 401 && session) {
      deleteSession(session.sessionToken);
      responseHeaders['set-cookie'] = 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
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

  request.raw.pipe(proxyReq);
}
