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
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

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

export const authApi = {
  me: () => api<Me>('/api/auth/me'),
  login: (name: string, password: string) =>
    api<Me>('/api/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
  logout: () => api<unknown>('/api/auth/logout', { method: 'POST' }),
  patients: () => api<Patient[]>('/api/patients'),
  createPatient: (name: string) =>
    api<Patient>('/api/patients', { method: 'POST', body: JSON.stringify({ name }) }),
  shifts: () => api<Shift[]>('/api/shifts'),
  timeBlocks: () => api<TimeBlock[]>('/api/time-blocks'),
  notes: () => api<Note[]>('/api/notes'),
  operators: () => api<Operator[]>('/api/operators'),
};
