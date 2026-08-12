export interface Config {
  port: number;
  notesUrl: string;
  sessionTtlMs: number;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 3000),
  notesUrl: process.env.NOTES_URL ?? 'http://localhost:8080',
  sessionTtlMs: 12 * 60 * 60 * 1000,
};
