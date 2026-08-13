export interface Me {
  name: string;
}

export interface Patient {
  id: string;
  name: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Shift {
  id: string;
  patientId: string;
  timeBlockId: number;
  date: string;
  updatedAt: number;
}

export interface TimeBlock {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  updatedAt: string;
  deleted: boolean;
}

export interface NoteCategory {
  name: string;
  iconName: string;
}

export interface Note {
  id: string;
  text: string;
  shiftId: string;
  noteDate: string;
  updatedAt: string;
  createdBy: number;
  category?: NoteCategory | null;
  deleted?: boolean;
  photoCount?: number;
}

export interface NotePhoto {
  id: string;
  noteId: string;
  filePath: string;
  origName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  deleted: boolean;
  createdAt: string;
}

export interface NoteUpdate {
  id: number;
  noteId: string;
  updatedBy: number;
  updatedAt: string;
  changes: string;
}

export interface Operator {
  id: number;
  name: string;
  deleted?: boolean;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && options.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

export function notePhotoUrl(noteId: string, photoId: string): string {
  return `/api/notes/${noteId}/photos/${photoId}`;
}

export const authApi = {
    me: () => api<Me>('/api/auth/me'),
    login: (name: string, password: string) =>
        api<Me>('/api/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
    logout: () => api<unknown>('/api/auth/logout', { method: 'POST' }),
    patients: () => api<Patient[]>('/api/patients'),
    createPatient: (name: string) =>
        api<Patient>('/api/patients', { method: 'POST', body: JSON.stringify({ name }) }),
    deletePatient: (id: string) => api<unknown>(`/api/patients/${id}`, { method: 'DELETE' }),
    shifts: () => api<Shift[]>('/api/shifts'),
    timeBlocks: () => api<TimeBlock[]>('/api/time-blocks'),
    notes: () => api<Note[]>('/api/notes'),
    notePhotos: (noteId: string) => api<NotePhoto[]>(`/api/notes/${noteId}/photos`),
    noteUpdates: (noteId: string) => api<NoteUpdate[]>(`/api/note-updates/${noteId}`),
    operators: () => api<Operator[]>('/api/operators'),
};
