export interface Me {
  name: string;
}

export interface Patient {
  id: string;
  name: string;
  updatedAt: string;
  deleted: boolean;
}

/** Extra data of a patient. Since it is created and updated
 *  together with the patient itself, the patient endpoints carry these fields.
 *  `null` from `patientInfo()` means the patient has no info yet. */
export interface PatientInfo {
  patientId: string;
  names: string;
  lastNames: string;
  historyNumber: string;
  updatedAt: string;
  deleted?: boolean;
}

/** Payload to create or update a patient: the display `name` plus its info. */
export interface PatientInput {
  displayName: string;
  names: string;
  lastNames: string;
  historyNumber: string;
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

/** The category as it was when the note was created, so notes keep their type
 *  even after the category is renamed, deleted or changed. It carries no
 *  `options`/`components`, so only the type can be read from it. */
export interface NoteCategory {
  name: string;
  iconName: string;
  categoryType: { type: CategoryType };
}

export const CATEGORY_TYPES = ['Numeric', 'Decimal', 'Text', 'Selection', 'Composite'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

/** A `Composite` category cannot hold components, so it is not offered inside one. */
export const COMPONENT_TYPES = ['Numeric', 'Decimal', 'Text', 'Selection'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export function isNumericCategoryType(type: CategoryType): boolean {
  return type === 'Numeric' || type === 'Decimal';
}

/** A field of a `Composite` category, defined inline instead of referencing a category. */
export interface Component {
  name: string;
  categoryType: { type: ComponentType };
  options?: string[];
  fixedText?: string;
}

export interface Category {
  name: string;
  iconName: string;
  categoryType: { type: CategoryType };
  fixedText?: string;
  categoryOrder?: number;
  deleted?: boolean;
  options?: string[];
  components?: Component[];
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

/** A general note about a patient, outside of any shift. `notes` holds the
 *  text itself. Notes are listed and reordered by `sortOrder`. */
export interface PatientNote {
  id: number;
  patientId: string;
  notes: string;
  sortOrder: number;
  updatedByUser: number;
  deleted: boolean;
}

export interface PatientNoteInput {
  notes: string;
  sortOrder: number;
}

export interface NoteUpdate {
  id: number;
  noteId: string;
  updatedByOperator: number;
  updatedByUser: number;
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

const TOKEN_KEY = 'notes-token';
const NAME_KEY = 'notes-name';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storedName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch {
    // Ignore storage access errors.
  }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && options.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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

export interface FetchBlobOptions extends RequestInit {
  auth?: boolean;
}

export async function fetchBlob(url: string, options: FetchBlobOptions = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  const { auth, ...rest } = options;
  if (auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...rest, headers });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  return res.blob();
}

export async function fetchText(url: string, options: RequestInit = {}): Promise<string> {
  const res = await fetch(url, options);
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  return (await res.text()).trim();
}

export const authApi = {
    me: (): Promise<Me | null> => {
      const token = getToken();
      const name = storedName();
      if (!token || !name) return Promise.resolve(null);
      return Promise.resolve({ name });
    },
    login: async (name: string, password: string) => {
      const res = await api<{ token: string; expiresAt: string }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ name, password }),
      });
      try {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(NAME_KEY, name);
      } catch {
        // Ignore storage access errors.
      }
      return { name };
    },
    logout: async () => {
      try {
        await api<unknown>('/api/logout', { method: 'POST' });
      } finally {
        clearSession();
      }
    },
    apkVersion: (): Promise<string> => fetchText('/apk/version'),
    patients: () => api<Patient[]>('/api/patients'),
    createPatient: (data: PatientInput) =>
        api<Patient>('/api/patients', { method: 'POST', body: JSON.stringify(data) }),
    updatePatient: (id: string, data: PatientInput) =>
        api<Patient>(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePatient: (id: string) => api<unknown>(`/api/patients/${id}`, { method: 'DELETE' }),
    patientInfo: (patientId: string) => api<PatientInfo | null>(`/api/patients/${patientId}/info`),
    patientNotes: (patientId: string) => api<PatientNote[]>(`/api/patients/${patientId}/notes`),
    createPatientNote: (patientId: string, note: PatientNoteInput) =>
        api<PatientNote>(`/api/patients/${patientId}/notes`, {
            method: 'POST',
            body: JSON.stringify(note),
        }),
    updatePatientNote: (patientId: string, noteId: number, note: PatientNoteInput) =>
        api<PatientNote>(`/api/patients/${patientId}/notes/${noteId}`, {
            method: 'PUT',
            body: JSON.stringify(note),
        }),
    deletePatientNote: (patientId: string, noteId: number) =>
        api<unknown>(`/api/patients/${patientId}/notes/${noteId}`, { method: 'DELETE' }),
    reorderPatientNotes: (patientId: string, noteIds: number[]) =>
        api<unknown>(`/api/patients/${patientId}/notes/reorder`, {
            method: 'PUT',
            body: JSON.stringify(noteIds),
        }),
    shifts: () => api<Shift[]>('/api/shifts'),
    timeBlocks: () => api<TimeBlock[]>('/api/time-blocks'),
    /** `showDeleted` also returns soft-deleted notes so the view can reveal them. */
    notesByShift: (shiftId: string, showDeleted = false) =>
        api<Note[]>(`/api/notes/shift/${encodeURIComponent(shiftId)}?showDeleted=${showDeleted}`),
    lastNotesByCategory: (patientId: string, categoryName: string, amount: number) =>
        api<Note[]>(`/api/notes/last/${patientId}/${encodeURIComponent(categoryName)}/${amount}`),
    notePhotos: (noteId: string) => api<NotePhoto[]>(`/api/notes/${noteId}/photos`),
    noteUpdates: (noteId: string) => api<NoteUpdate[]>(`/api/note-updates/${noteId}`),
    categories: () => api<Category[]>('/api/categories'),
    allCategories: () => api<Category[]>('/api/categories/all'),
    createCategory: (category: Category) =>
        api<unknown>('/api/categories', { method: 'POST', body: JSON.stringify(category) }),
    updateCategory: (oldName: string, category: Category) =>
        api<unknown>(`/api/categories/${encodeURIComponent(oldName)}`, {
            method: 'PUT',
            body: JSON.stringify(category),
        }),
    deleteCategory: (name: string) =>
        api<unknown>(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    restoreCategory: (name: string) =>
        api<unknown>(`/api/categories/restore/${encodeURIComponent(name)}`, { method: 'PUT' }),
    reorderCategories: (names: string[]) =>
        api<unknown>('/api/categories/all/reorder', {
            method: 'PUT',
            body: JSON.stringify(names),
        }),
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
