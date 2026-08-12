import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { createSession, deleteSession, getSession } from './sessions.js';
import { loginNotes, logoutNotes } from './notesClient.js';

const SESSION_COOKIE = 'session';

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (request, reply) => {
    const body = request.body as { name?: unknown; password?: unknown } | undefined;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!name || !password) {
      return reply.code(400).send({ error: 'Name and password are required' });
    }

    let token: string;
    try {
      token = await loginNotes(name, password);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      return reply.code(status === 401 ? 401 : 502).send({
        error: status === 401 ? 'Invalid name or password' : 'Could not reach the notes server',
      });
    }

    const { sessionToken } = createSession(name, token);
    return reply
      .setCookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        maxAge: Math.floor(config.sessionTtlMs / 1000),
      })
      .send({ name });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const session = getSession(request.cookies.session);
    if (session) {
      await logoutNotes(session.session.token);
      deleteSession(session.sessionToken);
    }
    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).send({});
  });

  app.get('/api/auth/me', async (request, reply) => {
    const session = getSession(request.cookies.session);
    if (!session) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
    return reply.send({ name: session.session.name });
  });
}
