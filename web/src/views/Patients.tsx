import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type Me, type Patient } from '../api/client';
import { serverErrorMessage } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface PatientsProps {
  me: Me;
  onLogout: () => void;
  onSelectPatient: (patient: Patient) => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Patients({ me, onLogout, onSelectPatient }: PatientsProps) {
  const { t, i18n } = useTranslation();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    authApi
      .patients()
      .then(setPatients)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setPatients([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('patients.title') }));
      });
  }, [t]);

  useEffect(() => {
    if (!showCreate) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowCreate(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreate]);

  function openCreate() {
    setNewName('');
    setCreateError('');
    setShowCreate(true);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreateError('');
    setCreating(true);
    try {
      const created = await authApi.createPatient(name);
      setPatients((prev) => (prev ? [...prev, created] : [created]));
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCreateError(t('errors.unauthorized'));
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setCreateError(t('patients.alreadyExists'));
        return;
      }
      setCreateError(serverErrorMessage(err) || t('patients.createFailed'));
    } finally {
      setCreating(false);
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

  const visible = (patients ?? [])
    .filter((p) => !p.deleted)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <span className="breadcrumb-current">{t('nav.patients')}</span>
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
            <h2>{t('patients.title')}</h2>
            <p className="section-subtitle">
              {patients === null
                ? t('common.loading')
                : t('patients.count', { count: visible.length })}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('patients.newPatient')}
          </button>
        </div>
        {error && <div className="error app-error">{error}</div>}
        <div className="patients-grid">
          {visible.map((patient) => (
            <button
              type="button"
              key={patient.id}
              className="patient-card"
              title={t('patients.viewShifts', { name: patient.name })}
              onClick={() => onSelectPatient(patient)}
            >
              <span className="avatar">{initials(patient.name) || '?'}</span>
              <span className="patient-info">
                <span className="patient-name">{patient.name}</span>
                <span className="patient-meta">
                  {patient.updatedAt ? t('patients.updated', { date: formatDate(patient.updatedAt, i18n.language) }) : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
        {showCreate && (
          <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-patient-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="create-patient-title" className="modal-title">
                {t('patients.newPatient')}
              </h3>
              <form onSubmit={handleCreate}>
                <label className="field">
                  <span>{t('patients.name')}</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('patients.namePlaceholder')}
                    autoFocus
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
                  <button type="submit" className="btn btn-primary" disabled={creating || !newName.trim()}>
                    {creating ? t('patients.creating') : t('patients.create')}
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
