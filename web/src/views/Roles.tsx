import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  authApi,
  PERMISSION_TYPES,
  type Me,
  type Role,
} from '../api/client';
import { serverErrorMessage } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface RolesProps {
  me: Me;
  onLogout: () => void;
}

export default function Roles({ me, onLogout }: RolesProps) {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [managingRole, setManagingRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [togglingPerm, setTogglingPerm] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .roles()
      .then(setRoles)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('roles.title') }));
      });
  }, [onLogout, t]);

  useEffect(() => {
    if (!showForm && !managingRole) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setShowForm(false);
      setManagingRole(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm, managingRole]);

  function openCreate() {
    setFormName('');
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
      const created = await authApi.createRole(name);
      setRoles((prev) => (prev ? [...prev, created] : [created]));
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(t('roles.alreadyExists'));
        return;
      }
      setFormError(serverErrorMessage(err) || t('roles.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function openPermissions(role: Role) {
    setManagingRole(role);
    setPermissionsError('');
    setRolePermissions(new Set());
    setPermissionsLoading(true);
    try {
      const perms = await authApi.rolePermissions(role.id);
      setRolePermissions(new Set(perms.map((p) => p.type)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setPermissionsError(serverErrorMessage(err) || t('roles.loadPermissionsFailed'));
    } finally {
      setPermissionsLoading(false);
    }
  }

  async function toggleAllPermissions(select: boolean) {
    if (!managingRole || togglingPerm !== null) return;
    setPermissionsError('');
    setTogglingPerm('*');
    const targets = PERMISSION_TYPES.filter((p) =>
      select ? !rolePermissions.has(p) : rolePermissions.has(p)
    );
    try {
      await Promise.all(
        targets.map((p) =>
          select
            ? authApi.addRolePermission(managingRole.id, p)
            : authApi.removeRolePermission(managingRole.id, p)
        )
      );
      setRolePermissions((prev) => {
        const next = new Set(prev);
        for (const p of targets) {
          if (select) next.add(p);
          else next.delete(p);
        }
        return next;
      });
    } catch (err) {
      setPermissionsError(serverErrorMessage(err) || t('roles.permissionUpdateFailed'));
    } finally {
      setTogglingPerm(null);
    }
  }

  async function togglePermission(permType: string) {
    if (!managingRole || togglingPerm !== null) return;
    setPermissionsError('');
    setTogglingPerm(permType);
    const had = rolePermissions.has(permType);
    try {
      if (had) {
        await authApi.removeRolePermission(managingRole.id, permType);
      } else {
        await authApi.addRolePermission(managingRole.id, permType);
      }
      setRolePermissions((prev) => {
        const next = new Set(prev);
        if (had) next.delete(permType);
        else next.add(permType);
        return next;
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPermissionsError(t('roles.permissionUpdateFailed'));
        return;
      }
      setPermissionsError(serverErrorMessage(err) || t('roles.permissionUpdateFailed'));
    } finally {
      setTogglingPerm(null);
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

  const all = roles ?? [];
  const active = all.filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <span className="breadcrumb-current">{t('nav.roles')}</span>
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
            <h2>{t('roles.title')}</h2>
            <p className="section-subtitle">
              {roles === null
                ? t('common.loading')
                : t('roles.count', { count: active.length })}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('roles.newRole')}
          </button>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {roles === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : active.length === 0 ? (
          <p className="empty-state">{t('roles.empty')}</p>
        ) : (
          <ul className="operator-list">
            {active.map((role) => (
              <li key={role.id} className="operator-item">
                <span className="operator-name">{role.name}</span>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('roles.managePermissions')}
                  aria-label={t('roles.managePermissions')}
                  onClick={() => openPermissions(role)}
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
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showForm && (
          <div className="modal-backdrop" onClick={() => setShowForm(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-role-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="create-role-title" className="modal-title">
                {t('roles.newRole')}
              </h3>
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span>{t('roles.name')}</span>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('roles.namePlaceholder')}
                    autoFocus
                    disabled={submitting}
                    required
                  />
                </label>
                {formError && <p className="error modal-error">{formError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowForm(false)}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !formName.trim()}
                  >
                    {submitting ? t('roles.creating') : t('roles.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {managingRole && (
          <div className="modal-backdrop" onClick={() => setManagingRole(null)}>
            <div
              className="modal modal-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="permissions-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="permissions-title" className="modal-title">
                {t('roles.permissionsTitle', { name: managingRole.name })}
              </h3>
              {permissionsLoading ? (
                <p className="section-subtitle">{t('common.loading')}</p>
              ) : (
                <>
                  {permissionsError && <p className="error modal-error">{permissionsError}</p>}
                  <div className="permission-tools">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={togglingPerm !== null}
                      onClick={() => toggleAllPermissions(true)}
                    >
                      {t('roles.selectAll')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={togglingPerm !== null}
                      onClick={() => toggleAllPermissions(false)}
                    >
                      {t('roles.deselectAll')}
                    </button>
                  </div>
                  <ul className="permission-list">
                    {PERMISSION_TYPES.map((permType) => (
                      <li key={permType} className="permission-item">
                        <label className="permission-label">
                          <input
                            type="checkbox"
                            checked={rolePermissions.has(permType)}
                            disabled={togglingPerm === permType}
                            onChange={() => togglePermission(permType)}
                          />
                          <span className="permission-name">{permType}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setManagingRole(null)}
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
