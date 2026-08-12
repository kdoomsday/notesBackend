import { randomBytes } from 'node:crypto';
import { config } from './config.js';

export interface Session {
  token: string;
  name: string;
  createdAt: number;
}

export interface SessionRecord {
  sessionToken: string;
  session: Session;
}

const sessions = new Map<string, Session>();

export function createSession(name: string, token: string): SessionRecord {
  const sessionToken = randomBytes(24).toString('base64url');
  const session: Session = { token, name, createdAt: Date.now() };
  sessions.set(sessionToken, session);
  return { sessionToken, session };
}

export function getSession(sessionToken: string | undefined): SessionRecord | null {
  if (!sessionToken) return null;
  const session = sessions.get(sessionToken);
  if (!session) return null;
  if (Date.now() - session.createdAt > config.sessionTtlMs) {
    sessions.delete(sessionToken);
    return null;
  }
  return { sessionToken, session };
}

export function deleteSession(sessionToken: string | undefined): void {
  if (sessionToken) sessions.delete(sessionToken);
}
