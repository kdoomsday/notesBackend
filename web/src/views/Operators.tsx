import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type Me, type Operator } from '../api/client';
import { serverErrorMessage } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface OperatorsProps {
  me: Me;
  onLogout: () => void;
}

export default function Operators({ me, onLogout }: OperatorsProps) {
  const { t } = useTranslation();
  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<Operator | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    authApi
      .operators()
      .then(setOperators)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setOperators([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('operators.title') }));
      });
  }, [t]);

  useEffect(() => {
    if (!showCreate && !toDelete) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setShowCreate(false);
      setToDelete(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreate, toDelete]);

  function openCreate() {
    setNewName('');
    setNewPin('');
    setCreateError('');
    setShowCreate(true);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    const pin = newPin.trim();
    if (!name || !pin || creating) return;
    setCreateError('');
    setCreating(true);
    try {
      const created = await authApi.createOperator(name, pin);
      setOperators((prev) => (prev ? [...prev, created] : [created]));
      setNewName('');
      setNewPin('');
      setShowCreate(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setCreateError(t('operators.alreadyExists'));
        return;
      }
      setCreateError(serverErrorMessage(err) || t('operators.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!toDelete || deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await authApi.deleteOperator(toDelete.id);
      setOperators((prev) =>
        prev ? prev.map((o) => (o.id === toDelete.id ? { ...o, deleted: true } : o)) : prev
      );
      setToDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setDeleteError(serverErrorMessage(err) || t('operators.deleteFailed'));
    } finally {
      setDeleting(false);
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

  const all = operators ?? [];
  const active = all.filter((o) => !o.deleted).sort((a, b) => a.name.localeCompare(b.name));
  const deleted = all.filter((o) => o.deleted).sort((a, b) => a.name.localeCompare(b.name));

  async function handleRestore(operator: Operator) {
    if (restoringId !== null) return;
    setRestoreError('');
    setRestoringId(operator.id);
    try {
      await authApi.restoreOperator(operator.id);
      setOperators((prev) =>
        prev ? prev.map((o) => (o.id === operator.id ? { ...o, deleted: false } : o)) : prev
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setRestoreError(serverErrorMessage(err) || t('operators.restoreFailed'));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <span className="breadcrumb-current">{t('nav.operators')}</span>
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
            <h2>{t('operators.title')}</h2>
            <p className="section-subtitle">
              {operators === null
                ? t('common.loading')
                : t('operators.count', { count: active.length })}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('operators.newOperator')}
          </button>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {operators === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : active.length === 0 ? (
          <p className="empty-state">
            {deleted.length > 0 ? t('operators.noActive') : t('operators.empty')}
          </p>
        ) : (
          <ul className="operator-list">
            {active.map((operator) => (
              <li key={operator.id} className="operator-item">
                <span className="operator-name">{operator.name}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title={t('operators.delete')}
                  aria-label={t('operators.delete', { name: operator.name })}
                  onClick={() => {
                    setDeleteError('');
                    setToDelete(operator);
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
          <section className="deleted-section" aria-label={t('operators.deletedSection')}>
            <div className="section-head section-head-row">
              <div>
                <h3 className="deleted-section-title">{t('operators.deletedSection')}</h3>
                <p className="section-subtitle">
                  {t('operators.deletedCount', { count: deleted.length })}
                </p>
              </div>
            </div>
            {restoreError && <div className="error app-error">{restoreError}</div>}
            <ul className="operator-list">
              {deleted.map((operator) => (
                <li key={operator.id} className="operator-item operator-item-deleted">
                  <span className="operator-name">{operator.name}</span>
                  <span className="operator-deleted-tag">{t('operators.deletedTag')}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-accent"
                    title={t('operators.restore')}
                    aria-label={t('operators.restore', { name: operator.name })}
                    disabled={restoringId !== null}
                    onClick={() => handleRestore(operator)}
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
        {showCreate && (
          <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-operator-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="create-operator-title" className="modal-title">
                {t('operators.newOperator')}
              </h3>
              <form onSubmit={handleCreate}>
                <label className="field">
                  <span>{t('operators.name')}</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('operators.namePlaceholder')}
                    autoFocus
                    disabled={creating}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t('operators.pin')}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder={t('operators.pinPlaceholder')}
                    disabled={creating}
                    required
                  />
                </label>
                {createError && <p className="error modal-error">{createError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreate(false)}
                    disabled={creating}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={creating || !newName.trim() || !newPin.trim()}
                  >
                    {creating ? t('operators.creating') : t('operators.create')}
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
              aria-labelledby="delete-operator-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="delete-operator-title" className="modal-title">
                {t('operators.deleteTitle')}
              </h3>
              <p className="modal-text">{t('operators.deleteConfirm', { name: toDelete.name })}</p>
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
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('operators.deleting') : t('operators.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
