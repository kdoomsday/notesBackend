'use strict';

const $ = (sel) => document.querySelector(sel);

const viewLogin = $('#view-login');
const viewApp = $('#view-app');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const userNameEl = $('#user-name');
const patientsGrid = $('#patients-grid');
const patientCount = $('#patient-count');
const appError = $('#app-error');
const logoutBtn = $('#logout-btn');

function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearError(el) {
  el.classList.add('hidden');
  el.textContent = '';
}

/**
 * Performs a fetch to the local API and parses the JSON response body.
 * On a non-2xx status it throws an Error whose message comes from the
 * server's `error` field (when available) and sets `err.status` to the
 * HTTP status code so callers can react to specific failures (e.g. 401).
 *
 * @param {string} url - The request URL (relative to the app origin).
 * @param {object} [options] - Extra fetch options, merged over the default
 *   `Content-Type: application/json` header.
 * @returns {Promise<object|string|null>} The parsed response body.
 */
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message = body && typeof body === 'object' && body.error ? body.error : `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * Builds a short avatar label from a person's name, taking at most the
 * first two words and uppercasing their initial letters.
 *
 * @param {string} name - The full name to abbreviate.
 * @returns {string} The initials (e.g. "John Doe" -> "JD"), or an empty
 *   string when name is empty.
 */
function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Clears and repopulates the patients grid with the non-deleted patients,
 * sorted alphabetically by name. Also updates the patient count subtitle.
 *
 * @param {Array<{id: string, name: string, deleted: boolean, updatedAt?: string}>} patients -
 *   The full patient list as returned by the server.
 */
function renderPatients(patients) {
  patientsGrid.textContent = '';
  const visible = patients
    .filter((p) => !p.deleted)
    .sort((a, b) => a.name.localeCompare(b.name));

  patientCount.textContent = visible.length === 1 ? '1 patient' : `${visible.length} patients`;

  for (const patient of visible) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'patient-card';
    card.title = patient.name;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials(patient.name) || '?';

    const info = document.createElement('span');
    info.className = 'patient-info';

    const name = document.createElement('span');
    name.className = 'patient-name';
    name.textContent = patient.name;

    const meta = document.createElement('span');
    meta.className = 'patient-meta';
    meta.textContent = patient.updatedAt ? `Updated ${formatDate(patient.updatedAt)}` : '';

    info.append(name, meta);
    card.append(avatar, info);
    patientsGrid.append(card);
  }
}

/**
 * Fetches the patient list from the API and renders it. Any failure is
 * reported in the app error banner instead of being thrown.
 *
 * @returns {Promise<void>}
 */
async function loadPatients() {
  clearError(appError);
  try {
    const patients = await api('/api/patients');
    renderPatients(patients);
  } catch (err) {
    if (err.status === 401) {
      showLogin();
      showError(loginError, 'Session expired. Please sign in again.');
      return;
    }
    showError(appError, err.message === 'Could not reach the notes server' ? err.message : `Could not load patients: ${err.message}`);
  }
}

/**
 * Switches from the login view to the application view for the given
 * signed-in user and starts loading the patient list.
 *
 * @param {{name: string}} me - The authenticated user.
 */
function showApp(me) {
  viewLogin.classList.add('hidden');
  viewApp.classList.remove('hidden');
  userNameEl.textContent = me.name;
  loadPatients();
}

function showLogin() {
  viewApp.classList.add('hidden');
  viewLogin.classList.remove('hidden');
  clearError(loginError);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError(loginError);

  const name = $('#login-name').value.trim();
  const password = $('#login-password').value;

  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const me = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });
    loginForm.reset();
    showApp(me);
  } catch (err) {
    showError(loginError, err.message);
  } finally {
    button.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore: session is cleared client-side regardless.
  }
  showLogin();
});

/**
 * Restores the session on startup: renders the app when the session cookie
 * is still valid, otherwise falls back to the login view (also surfacing a
 * message when the server itself is unreachable).
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    const me = await api('/api/auth/me');
    showApp(me);
  } catch (err) {
    if (err.status === 401) {
      showLogin();
    } else {
      showLogin();
      showError(loginError, `Could not reach the server: ${err.message}`);
    }
  }
}

init();
