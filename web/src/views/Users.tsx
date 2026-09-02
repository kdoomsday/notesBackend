import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type Me, type PresentationUser, type Role } from '../api/client';
import { serverErrorMessage } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface UsersProps {
  me: Me;
  onLogout: () => void;
}

export default function Users({ me, onLogout }: UsersProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<PresentationUser[] | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PresentationUser | null>(null);
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<PresentationUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [roleByUser, setRoleByUser] = useState<Record<number, Role | null>>({});
  const [assigningUser, setAssigningUser] = useState<PresentationUser | null>(null);
  const [assignRoleId, setAssignRoleId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    authApi
      .users()
      .then(setUsers)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setUsers([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('users.title') }));
      });
  }, [t]);

  useEffect(() => {
    authApi
      .roles()
      .then((data) => setRoles(data.filter((r) => !r.deleted)))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (!users) return;
    let cancelled = false;
    Promise.all(
      users.map(async (user) => {
        try {
          const role = await authApi.userRole(user.id);
          return [user.id, role] as const;
        } catch {
          return [user.id, null] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      setRoleByUser(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [users]);

  useEffect(() => {
    if (!showForm && !toDelete && !assigningUser) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setShowForm(false);
      setEditing(null);
      setToDelete(null);
      setAssigningUser(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm, toDelete, assigningUser]);

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormPassword('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(user: PresentationUser) {
    setEditing(user);
    setFormName(user.name);
    setFormPassword('');
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = formName.trim();
    if (!name || submitting) return;
    setFormError('');
    setSubmitting(true);
    try {
      if (editing) {
        const body: { name: string; password?: string } = { name };
        const pw = formPassword.trim();
        if (pw) body.password = pw;
        await authApi.updateUser(editing.id, body);
        setUsers((prev) =>
          prev ? prev.map((u) => (u.id === editing.id ? { ...u, name } : u)) : prev
        );
      } else {
        const pw = formPassword.trim();
        if (!pw) {
          setFormError(t('users.passwordRequired'));
          setSubmitting(false);
          return;
        }
        const created = await authApi.createUser(name, pw);
        setUsers((prev) =>
          prev ? [...prev, created] : [created]
        );
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError(t('errors.unauthorized'));
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setFormError(t('users.alreadyExists'));
        return;
      }
      setFormError(
        serverErrorMessage(err) || (editing ? t('users.updateFailed') : t('users.createFailed'))
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleDelete() {
    if (!toDelete || deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await authApi.toggleDeleteUser(toDelete.id);
      setUsers((prev) =>
        prev
          ? prev.map((u) => (u.id === toDelete.id ? { ...u, deleted: !u.deleted } : u))
          : prev
      );
      setToDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setDeleteError(t('errors.unauthorized'));
        return;
      }
      setDeleteError(serverErrorMessage(err) || t('users.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  function openAssign(user: PresentationUser) {
    setAssignError('');
    setAssignRoleId(roleByUser[user.id]?.id ?? null);
    setAssigningUser(user);
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!assigningUser || assignRoleId === null || assigning) return;
    setAssignError('');
    setAssigning(true);
    try {
      await authApi.assignUserRole(assigningUser.id, assignRoleId);
      const role = roles?.find((r) => r.id === assignRoleId) ?? null;
      setRoleByUser((prev) => ({ ...prev, [assigningUser.id]: role }));
      setAssigningUser(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAssignError(t('errors.unauthorized'));
        return;
      }
      setAssignError(serverErrorMessage(err) || t('users.assignRoleFailed'));
    } finally {
      setAssigning(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }

  const all = users ?? [];
  const active = all.filter((u) => !u.deleted).sort((a, b) => a.name.localeCompare(b.name));
  const deleted = all.filter((u) => u.deleted).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <span className="breadcrumb-current">{t('nav.users')}</span>
          </div>
          <div className="user-area">
            <LanguageSwitcher />
            <span className="user-name">{me.name}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              {t('nav.logOut')}
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="section-head section-head-row">
          <div>
            <h2>{t('users.title')}</h2>
            <p className="section-subtitle">
              {users === null
                ? t('common.loading')
                : t('users.count', { count: active.length })}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('users.newUser')}
          </button>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {users === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : active.length === 0 ? (
          <p className="empty-state">
            {deleted.length > 0 ? t('users.noActive') : t('users.empty')}
          </p>
        ) : (
          <ul className="operator-list">
            {active.map((user) => (
              <li key={user.id} className="operator-item">
                <span className="operator-name">{user.name}</span>
                <span
                  className="role-badge"
                  title={t('users.role')}
                  onClick={() => openAssign(user)}
                >
                  {roleByUser[user.id]?.name ?? t('users.noRole')}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('users.assignRole')}
                  aria-label={t('users.assignRole')}
                  onClick={() => openAssign(user)}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('users.edit')}
                  aria-label={t('users.edit')}
                  onClick={() => openEdit(user)}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title={t('users.delete')}
                  aria-label={t('users.delete')}
                  onClick={() => {
                    setDeleteError('');
                    setToDelete(user);
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {deleted.length > 0 && (
          <section className="deleted-section" aria-label={t('users.deletedSection')}>
            <div className="section-head section-head-row">
              <div>
                <h3 className="deleted-section-title">{t('users.deletedSection')}</h3>
                <p className="section-subtitle">
                  {t('users.deletedCount', { count: deleted.length })}
                </p>
              </div>
            </div>
            {restoreError && <div className="error app-error">{restoreError}</div>}
            <ul className="operator-list">
              {deleted.map((user) => (
                <li key={user.id} className="operator-item operator-item-deleted">
                  <span className="operator-name">{user.name}</span>
                  <span className="operator-deleted-tag">{t('users.deletedTag')}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-accent"
                    title={t('users.restore')}
                    aria-label={t('users.restore')}
                    disabled={restoringId !== null}
                    onClick={async () => {
                      setRestoreError('');
                      setRestoringId(user.id);
                      try {
                        await authApi.toggleDeleteUser(user.id);
                        setUsers((prev) =>
                          prev
                            ? prev.map((u) =>
                                u.id === user.id ? { ...u, deleted: false } : u
                              )
                            : prev
                        );
                      } catch (err) {
                        if (err instanceof ApiError && err.status === 401) {
                          setRestoreError(t('errors.unauthorized'));
                          return;
                        }
                        setRestoreError(
                          serverErrorMessage(err) || t('users.restoreFailed')
                        );
                      } finally {
                        setRestoringId(null);
                      }
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {showForm && (
          <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditing(null); }}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-form-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="user-form-title" className="modal-title">
                {editing ? t('users.edit') : t('users.newUser')}
              </h3>
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span>{t('users.name')}</span>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('users.namePlaceholder')}
                    autoFocus
                    disabled={submitting}
                    required
                  />
                </label>
                <label className="field">
                  <span>{editing ? t('users.newPassword') : t('users.password')}</span>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={t('users.passwordPlaceholder')}
                    disabled={submitting}
                    required={!editing}
                  />
                </label>
                {formError && <p className="error modal-error">{formError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setShowForm(false); setEditing(null); }}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !formName.trim()}
                  >
                    {submitting
                      ? (editing ? t('users.saving') : t('users.creating'))
                      : (editing ? t('users.save') : t('users.create'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {toDelete && (
          <div className="modal-backdrop" onClick={() => setToDelete(null)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="delete-user-title" className="modal-title">
                {t('users.deleteTitle')}
              </h3>
              <p className="modal-text">{t('users.deleteConfirm', { name: toDelete.name })}</p>
              {deleteError && <p className="error modal-error">{deleteError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setToDelete(null)}
                  disabled={deleting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleToggleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('users.deleting') : t('users.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      {assigningUser && (
          <div className="modal-backdrop" onClick={() => setAssigningUser(null)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="assign-role-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="assign-role-title" className="modal-title">
                {t('users.assignRoleTitle', { name: assigningUser.name })}
              </h3>
              <form onSubmit={handleAssign} className="role-assign-form">
                {!roles || roles.length === 0 ? (
                  <p className="empty-state">{t('users.noRolesAvailable')}</p>
                ) : (
                  <ul className="role-card-list">
                    {roles.map((role) => {
                      const selected = assignRoleId === role.id;
                      return (
                        <li key={role.id} className="role-card-item">
                          <label
                            className={`role-card${selected ? ' role-card-selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="role"
                              value={role.id}
                              checked={selected}
                              disabled={assigning}
                              onChange={() => setAssignRoleId(role.id)}
                            />
                            <span className="role-card-name">{role.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {assignError && <p className="error modal-error">{assignError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setAssigningUser(null)}
                    disabled={assigning}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={assigning || assignRoleId === null}
                  >
                    {assigning ? t('users.assigning') : t('users.assign')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
