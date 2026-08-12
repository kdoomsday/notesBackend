import { useEffect, useState } from 'react';
import { ApiError, authApi, type Me, type Patient } from '../api/client';

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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Patients({ me, onLogout, onSelectPatient }: PatientsProps) {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi
      .patients()
      .then(setPatients)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load patients');
      });
  }, [onLogout]);

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
            <span className="breadcrumb-current">Patients</span>
          </div>
          <div className="user-area">
            <span className="user-name">{me.name}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="section-head">
          <h2>Patients</h2>
          <p className="section-subtitle">
            {patients === null
              ? 'Loading…'
              : visible.length === 1
                ? '1 patient'
                : `${visible.length} patients`}
          </p>
        </div>
        {error && <div className="error app-error">{error}</div>}
        <div className="patients-grid">
          {visible.map((patient) => (
            <button
              type="button"
              key={patient.id}
              className="patient-card"
              title={`${patient.name} — view shifts`}
              onClick={() => onSelectPatient(patient)}
            >
              <span className="avatar">{initials(patient.name) || '?'}</span>
              <span className="patient-info">
                <span className="patient-name">{patient.name}</span>
                <span className="patient-meta">
                  {patient.updatedAt ? `Updated ${formatDate(patient.updatedAt)}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
