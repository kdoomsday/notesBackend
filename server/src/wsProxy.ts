import http from 'node:http';
import https from 'node:https';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';

const SHIFT_WS_ROUTE = /^\/api\/shifts\/[^/]+\/ws$/;

const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'authorization',
  'sec-websocket-extensions',
  'sec-websocket-protocol',
]);

function notesBase(): string {
  return config.notesUrl.endsWith('/') ? config.notesUrl : config.notesUrl + '/';
}

function writeError(socket: Duplex, status: number, message: string): void {
  if (socket.destroyed) return;
  const body = JSON.stringify({ error: message });
  socket.end(
    `HTTP/1.1 ${status} ${http.STATUS_CODES[status] ?? ''}\r\n` +
      'Content-Type: application/json; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      'Connection: close\r\n\r\n' +
      body
  );
}

export function registerWebSocketProxy(app: FastifyInstance): void {
  app.server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (!SHIFT_WS_ROUTE.test(requestUrl.pathname)) {
      writeError(socket, 404, 'Not found');
      return;
    }

    const token = requestUrl.searchParams.get('token');
    if (!token) {
      writeError(socket, 401, 'Not authenticated');
      return;
    }
    requestUrl.searchParams.delete('token');

    const target = new URL(requestUrl.pathname + requestUrl.search, notesBase());

    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
      headers[key] = value;
    }
    headers.authorization = `Bearer ${token}`;

    const transport = target.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(target, { method: 'GET', headers });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      const accept = proxyRes.headers['sec-websocket-accept'];
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          (typeof accept === 'string' ? `Sec-WebSocket-Accept: ${accept}\r\n` : '') +
          '\r\n'
      );
      if (proxyHead.length > 0) socket.write(proxyHead);
      if (head.length > 0) proxySocket.write(head);

      proxySocket.on('error', () => socket.destroy());
      socket.on('error', () => proxySocket.destroy());
      proxySocket.on('close', () => socket.destroy());
      socket.on('close', () => proxySocket.destroy());
      proxySocket.pipe(socket).pipe(proxySocket);
    });

    proxyReq.on('response', (proxyRes) => {
      const status = proxyRes.statusCode ?? 502;
      const lines = Object.entries(proxyRes.headers)
        .filter(([key]) => key.toLowerCase() !== 'connection')
        .flatMap(([key, value]) =>
          Array.isArray(value) ? value.map((item) => `${key}: ${item}`) : [`${key}: ${value ?? ''}`]
        );
      socket.write(
        `HTTP/1.1 ${status} ${http.STATUS_CODES[status] ?? ''}\r\n` +
          `${lines.join('\r\n')}\r\n` +
          'Connection: close\r\n\r\n'
      );
      proxyRes.pipe(socket);
    });

    proxyReq.on('error', () => writeError(socket, 502, 'Could not reach the notes server'));
    proxyReq.end();
  });
}
