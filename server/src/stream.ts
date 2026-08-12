import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { deleteSession, getSession, type SessionRecord } from './sessions.js';
import { requestNotes } from './notesClient.js';

const POLL_INTERVAL_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 15000;

interface StreamItem {
  id: string;
  updatedAt: unknown;
  [key: string]: unknown;
}

interface StreamOptions {
  route: string;
  eventName: string;
  buildUrl: (since: string) => string;
  itemSince: (item: StreamItem) => string;
  initialSince: (raw: string | undefined) => string;
}

async function fetchItems(
  token: string,
  since: string,
  options: StreamOptions
): Promise<{ items: StreamItem[]; unauthorized: boolean }> {
  const res = await requestNotes(options.buildUrl(since), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    return { items: [], unauthorized: true };
  }
  if (res.status !== 200) {
    return { items: [], unauthorized: false };
  }
  try {
    const parsed: unknown = JSON.parse(res.body);
    return { items: Array.isArray(parsed) ? (parsed as StreamItem[]) : [], unauthorized: false };
  } catch {
    return { items: [], unauthorized: false };
  }
}

export function registerStream(app: FastifyInstance, options: StreamOptions): void {
  app.get(options.route, async (request, reply) => {
    const session = getSession(request.cookies.session);
    if (!session) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
    handleStream(request, reply, session, options);
  });
}

function handleStream(
  request: FastifyRequest,
  reply: FastifyReply,
  session: SessionRecord,
  options: StreamOptions
): void {
  reply.hijack();

  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let since = options.initialSince((request.query as { since?: string }).since);

  let closed = false;
  let pollTimer: NodeJS.Timeout | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;

  const close = () => {
    if (closed) return;
    closed = true;
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    raw.end();
  };

  request.raw.on('close', close);

  const poll = async () => {
    if (closed) return;
    const { items, unauthorized } = await fetchItems(session.session.token, since, options);
    if (unauthorized) {
      deleteSession(session.sessionToken);
      close();
      return;
    }
    if (closed) return;

    let maxSince = since;
    for (const item of items) {
      const itemSince = options.itemSince(item);
      if (itemSince > maxSince) {
        maxSince = itemSince;
      }
      if (closed) return;
      raw.write(`event: ${options.eventName}\ndata: ${JSON.stringify(item)}\n\n`);
    }
    since = maxSince;
  };

  pollTimer = setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);

  heartbeatTimer = setInterval(() => {
    if (closed) return;
    raw.write(': keep-alive\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  void poll();
}

export function registerNotesStream(app: FastifyInstance): void {
  registerStream(app, {
    route: '/api/notes/stream',
    eventName: 'note',
    buildUrl: (since) => `/api/notes/new/${encodeURIComponent(since)}`,
    itemSince: (item) => (typeof item.updatedAt === 'string' ? item.updatedAt : ''),
    initialSince: (raw) => (raw && !Number.isNaN(Date.parse(raw)) ? raw : new Date(0).toISOString()),
  });
}

export function registerShiftsStream(app: FastifyInstance): void {
  registerStream(app, {
    route: '/api/shifts/stream',
    eventName: 'shift',
    buildUrl: (since) => `/api/shifts/new/${since}`,
    itemSince: (item) => (typeof item.updatedAt === 'number' ? String(item.updatedAt) : ''),
    initialSince: (raw) => (raw && /^\d+$/.test(raw) ? raw : '0'),
  });
}
