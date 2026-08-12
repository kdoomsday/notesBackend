'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const NOTES_URL = process.env.NOTES_URL || 'http://localhost:8080';
const WEB_DIR = path.join(__dirname, 'web');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const sessions = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function getSession(req) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function sendJson(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...extraHeaders,
  });
  res.end(data);
}

function readJsonBody(req, limit = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function requestNotes(pathname, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(pathname, NOTES_URL.endsWith('/') ? NOTES_URL : NOTES_URL + '/');
    const options = { method, headers, timeout: 5000 };
    const req = http.request(target, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('notes server timeout'));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function handleLogin(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: err.message === 'body too large' ? 'Body too large' : 'Invalid JSON body' });
  }

  const name = String(body.name || '').trim();
  const password = String(body.password || '');
  if (!name || !password) {
    return sendJson(res, 400, { error: 'Name and password are required' });
  }

  let result;
  try {
    result = await requestNotes('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
  } catch (err) {
    return sendJson(res, 502, { error: 'Could not reach the notes server' });
  }

  if (result.status === 401) {
    return sendJson(res, 401, { error: 'Invalid name or password' });
  }
  if (result.status !== 200) {
    return sendJson(res, 502, { error: 'Notes server returned an error' });
  }

  let token;
  try {
    token = JSON.parse(result.body).token;
  } catch {
    return sendJson(res, 502, { error: 'Notes server returned an invalid response' });
  }

  const sessionToken = crypto.randomBytes(24).toString('base64url');
  sessions.set(sessionToken, { token, name, createdAt: Date.now() });

  sendJson(
    res,
    200,
    { name },
    {
      'Set-Cookie': `session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
    }
  );
}

async function handleLogout(req, res) {
  const session = getSession(req);
  if (session && session.token) {
    try {
      await requestNotes('/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch {
      // Ignore revocation errors; the local session is cleared regardless.
    }
  }
  const token = parseCookies(req).session;
  if (token) sessions.delete(token);
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
  });
  res.end('{}');
}

function handleMe(req, res) {
  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
  sendJson(res, 200, { name: session.name });
}

function proxyToNotes(req, res, skipAuth = false) {
  const session = getSession(req);
  if (!skipAuth && !session) {
    return sendJson(res, 401, { error: 'Not authenticated' });
  }

  const target = new URL(req.url, NOTES_URL.endsWith('/') ? NOTES_URL : NOTES_URL + '/');

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (['host', 'connection', 'cookie', 'set-cookie', 'accept-encoding'].includes(lower)) continue;
    headers[key] = value;
  }
  if (session) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const proxyReq = http.request(target, { method: req.method, headers }, (proxyRes) => {
    const responseHeaders = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      const lower = key.toLowerCase();
      if (['connection', 'transfer-encoding', 'keep-alive', 'upgrade', 'set-cookie', 'content-encoding'].includes(lower)) continue;
      responseHeaders[key] = value;
    }
    if (proxyRes.statusCode === 401 && session) {
      sessions.delete(session.token);
      responseHeaders['Set-Cookie'] = 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
    }
    res.writeHead(proxyRes.statusCode || 502, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      sendJson(res, 502, { error: 'Could not reach the notes server' });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res, urlPath) {
  let filePath = path.normalize(path.join(WEB_DIR, decodeURIComponent(urlPath)));
  if (!filePath.startsWith(WEB_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  if (urlPath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (urlPath !== '/' && !urlPath.includes('.')) {
        fs.readFile(path.join(WEB_DIR, 'index.html'), (err2, indexData) => {
          if (err2) return sendJson(res, 404, { error: 'Not found' });
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(indexData);
        });
        return;
      }
      return sendJson(res, 404, { error: 'Not found' });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  if (urlPath === '/api/auth/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }
  if (urlPath === '/api/auth/logout' && req.method === 'POST') {
    return handleLogout(req, res);
  }
  if (urlPath === '/api/auth/me' && req.method === 'GET') {
    return handleMe(req, res);
  }
  if (urlPath === '/health' && req.method === 'GET') {
    return proxyToNotes(req, res, true);
  }
  if (urlPath.startsWith('/api/')) {
    return proxyToNotes(req, res);
  }

  return serveStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log(`Notes web app listening on http://localhost:${PORT}`);
  console.log(`Proxying /api to ${NOTES_URL}`);
});
