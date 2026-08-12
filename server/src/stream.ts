import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { deleteSession, getSession, type SessionRecord } from './sessions.js';
import { requestNotes } from './notesClient.js';

const POLL_INTERVAL_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 15000;

interface NoteEvent {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  [key: string]: unknown;
}

async function fetchNotesSince(token: string, since: string): Promise<{ notes: NoteEvent[]; unauthorized: boolean }> {
  const res = await requestNotes(`/api/notes/new/${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    return { notes: [], unauthorized: true };
  }
  if (res.status !== 200) {
    return { notes: [], unauthorized: false };
  }
  try {
    const parsed: unknown = JSON.parse(res.body);
    return { notes: Array.isArray(parsed) ? (parsed as NoteEvent[]) : [], unauthorized: false };
  } catch {
    return { notes: [], unauthorized: false };
  }
}

export async function registerNotesStream(app: FastifyInstance): Promise<void> {
  app.get('/api/notes/stream', async (request, reply) => {
    const session = getSession(request.cookies.session);
    if (!session) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
    handleStream(request, reply, session);
  });
}

function handleStream(request: FastifyRequest, reply: FastifyReply, session: SessionRecord): void {
  reply.hijack();

  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sinceRaw = (request.query as { since?: string }).since;
  let since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? sinceRaw : new Date(0).toISOString();

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
    const { notes, unauthorized } = await fetchNotesSince(session.session.token, since);
    if (unauthorized) {
      deleteSession(session.sessionToken);
      close();
      return;
    }
    if (closed) return;

    let maxSince = since;
    for (const note of notes) {
      if (typeof note.updatedAt === 'string' && note.updatedAt > maxSince) {
        maxSince = note.updatedAt;
      }
      if (closed) return;
      raw.write(`event: note\ndata: ${JSON.stringify(note)}\n\n`);
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
