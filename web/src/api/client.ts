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

export interface Category {
  name: string;
  iconName: string;
  categoryType: { type: 'Numeric' | 'Text' };
  fixedText?: string;
  deleted?: boolean;
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
  pin?: string;
  deleted?: boolean;
}

export interface PresentationUser {
  id: number;
  name: string;
  deleted: boolean;
}

export interface User {
  id: number;
  name: string;
  passwordHash: string;
  salt: string;
  deleted: boolean;
}

export interface UserUpdate {
  name: string;
  password?: string;
}

export interface Role {
  id: number;
  name: string;
  deleted: boolean;
}

export interface RolePermission {
  id: number;
  name: string;
}

export interface PresentationPermission {
  id: number;
  name: string;
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
    lastNotesByCategory: (patientId: string, categoryName: string, amount: number) =>
        api<Note[]>(`/api/notes/last/${patientId}/${encodeURIComponent(categoryName)}/${amount}`),
    notePhotos: (noteId: string) => api<NotePhoto[]>(`/api/notes/${noteId}/photos`),
    noteUpdates: (noteId: string) => api<NoteUpdate[]>(`/api/note-updates/${noteId}`),
    categories: () => api<Category[]>('/api/categories'),
    createCategory: (category: Category) =>
        api<unknown>('/api/categories', { method: 'POST', body: JSON.stringify(category) }),
    updateCategory: (oldName: string, category: Category) =>
        api<unknown>(`/api/categories/${encodeURIComponent(oldName)}`, {
            method: 'PUT',
            body: JSON.stringify(category),
        }),
    toggleDeleteCategory: (name: string) =>
        api<unknown>(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    operators: () => api<Operator[]>('/api/operators'),
    createOperator: (name: string, pin: string) =>
        api<Operator>('/api/operators', { method: 'POST', body: JSON.stringify({ name, pin }) }),
    deleteOperator: (id: number) => api<unknown>(`/api/operators/${id}`, { method: 'DELETE' }),
    restoreOperator: (id: number) =>
        api<unknown>(`/api/operators/restore/${id}`, { method: 'DELETE' }),
    changePin: (id: number, oldPin: string, newPin: string) =>
        api<unknown>(`/api/operators/change-pin/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ oldPin, newPin }),
        }),
    users: () => api<PresentationUser[]>('/api/users'),
    createUser: (name: string, password: string) =>
        api<User>('/api/users', {
            method: 'POST',
            body: JSON.stringify({ name, password }),
        }),
    updateUser: (id: number, user: UserUpdate) =>
        api<unknown>(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(user),
        }),
    toggleDeleteUser: (id: number) =>
        api<unknown>(`/api/users/${id}`, { method: 'DELETE' }),
    userRole: (userId: number) => api<Role | null>(`/api/roles/user/${userId}`),
    assignUserRole: (userId: number, roleId: number) =>
        api<unknown>(`/api/roles/${roleId}/users/${userId}`, { method: 'PUT' }),
    roles: () => api<Role[]>('/api/roles'),
    createRole: (name: string) =>
        api<Role>('/api/roles', { method: 'POST', body: JSON.stringify({ name }) }),
    rolePermissions: (roleId: number) =>
        api<RolePermission[]>(`/api/roles/${roleId}/permissions`),
    permissionsOfCurrentUser: () =>
        api<RolePermission[]>('/api/roles/user-permissions'),
    addRolePermission: (roleId: number, permissionId: number) =>
        api<unknown>(`/api/roles/${roleId}/permissions/${permissionId}`, { method: 'PUT' }),
    removeRolePermission: (roleId: number, permissionId: number) =>
        api<unknown>(`/api/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' }),
    permissions: () => api<PresentationPermission[]>('/api/permissions'),
};

export async function myPermissions(): Promise<Set<string>> {
  const perms = await authApi.permissionsOfCurrentUser();
  return new Set(perms.map((p) => p.name));
}
