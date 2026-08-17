import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, type Me, type Patient, type Shift } from './api/client';
import { useToast } from './components/Toast';
import { getLogoUrl, subscribeLogo } from './config';
import Login from './views/Login';
import Patients from './views/Patients';
import Shifts from './views/Shifts';
import Notes from './views/Notes';
import Categories from './views/Categories';
import Operators from './views/Operators';

type Section = 'patients' | 'categories' | 'operators';

function NavIcon({ name }: { name: 'patients' | 'categories' | 'operators' }) {
  if (name === 'patients') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === 'categories') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function App() {
  const { t } = useTranslation();
  const notify = useToast();
  const logoUrl = useSyncExternalStore(subscribeLogo, getLogoUrl);
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<Section>('patients');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedShiftList, setSelectedShiftList] = useState<Shift[]>([]);

  const handleLogout = useCallback(() => {
    setMe(null);
    setSection('patients');
    setSelectedPatient(null);
    setSelectedShift(null);
    setSelectedShiftList([]);
  }, []);

  const handlePatientDeleted = useCallback(() => {
    setSelectedShift(null);
    setSelectedShiftList([]);
    setSelectedPatient(null);
    setSection('patients');
    notify(t('patients.deleted'), 'warning');
  }, [notify, t]);

  const goToSection = useCallback((next: Section) => {
    setSelectedPatient(null);
    setSelectedShift(null);
    setSelectedShiftList([]);
    setSection(next);
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const el = document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (selectedShift) {
        setSelectedShift(null);
      } else if (selectedPatient) {
        setSelectedPatient(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPatient, selectedShift]);

  if (checking) return null;

  if (!me) return <Login onLogin={setMe} />;

  let content: ReactNode;
  if (selectedPatient && selectedShift) {
    content = (
      <Notes
        me={me}
        patient={selectedPatient}
        shift={selectedShift}
        shifts={selectedShiftList}
        onBack={() => {
          setSelectedShift(null);
          setSelectedShiftList([]);
        }}
        onBackToPatients={() => {
          setSelectedShift(null);
          setSelectedShiftList([]);
          setSelectedPatient(null);
        }}
        onNavigateShift={setSelectedShift}
        onLogout={handleLogout}
      />
    );
  } else if (selectedPatient) {
    content = (
      <Shifts
        me={me}
        patient={selectedPatient}
        onBack={() => setSelectedPatient(null)}
        onPatientDeleted={handlePatientDeleted}
        onSelectShift={(shift, orderedShifts) => {
          setSelectedShift(shift);
          setSelectedShiftList(orderedShifts);
        }}
        onLogout={handleLogout}
      />
    );
  } else if (section === 'categories') {
    content = <Categories me={me} onLogout={handleLogout} />;
  } else if (section === 'operators') {
    content = <Operators me={me} onLogout={handleLogout} />;
  } else {
    content = <Patients me={me} onLogout={handleLogout} onSelectPatient={setSelectedPatient} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {logoUrl ? <img className="sidebar-logo" src={logoUrl} alt="" /> : t('app.title')}
        </div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-link${section === 'patients' ? ' sidebar-link-active' : ''}`}
            onClick={() => goToSection('patients')}
          >
            <NavIcon name="patients" />
            {t('nav.patients')}
          </button>
          <button
            type="button"
            className={`sidebar-link${section === 'categories' ? ' sidebar-link-active' : ''}`}
            onClick={() => goToSection('categories')}
          >
            <NavIcon name="categories" />
            {t('nav.categories')}
          </button>
          <button
            type="button"
            className={`sidebar-link${section === 'operators' ? ' sidebar-link-active' : ''}`}
            onClick={() => goToSection('operators')}
          >
            <NavIcon name="operators" />
            {t('nav.operators')}
          </button>
        </nav>
      </aside>
      <div className="app-content">{content}</div>
    </div>
  );
}
