import http from 'node:http';
import { config } from './config.js';

export interface NotesResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

export interface NotesRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function notesBase(): string {
  return config.notesUrl.endsWith('/') ? config.notesUrl : config.notesUrl + '/';
}

export function requestNotes(path: string, options: NotesRequestOptions = {}): Promise<NotesResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(path, notesBase());
    const req = http.request(
      target,
      { method: options.method ?? 'GET', headers: options.headers, timeout: 5000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 502,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('notes server timeout'));
    });
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

export async function loginNotes(name: string, password: string): Promise<string> {
  const res = await requestNotes('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  });
  if (res.status === 401) {
    const err = new Error('Invalid name or password') as Error & { status: number };
    err.status = 401;
    throw err;
  }
  if (res.status !== 200) {
    throw new Error(`Notes server returned ${res.status}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new Error('Notes server returned an invalid response');
  }

  if (!parsed || typeof parsed !== 'object' || !('token' in parsed) || typeof parsed.token !== 'string') {
    throw new Error('Notes server returned an invalid response');
  }
  return parsed.token;
}

export async function logoutNotes(token: string): Promise<void> {
  try {
    await requestNotes('/api/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best effort: the local session is cleared regardless.
  }
}
