import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, myPermissions, type Me, type Patient, type Shift } from './api/client';
import { useToast } from './components/Toast';
import { getLogoUrl, subscribeLogo } from './config';
import Login from './views/Login';
import Patients from './views/Patients';
import Shifts from './views/Shifts';
import Notes from './views/Notes';
import Categories from './views/Categories';
import Operators from './views/Operators';
import Users from './views/Users';
import Roles from './views/Roles';
import LanguageSwitcher from './components/LanguageSwitcher';

type Section = 'patients' | 'categories' | 'operators' | 'users' | 'roles';

const SECTION_PERMISSION: Record<Section, string> = {
  patients: 'List Patients',
  categories: 'List Categories',
  operators: 'List Operators',
  users: 'List Users',
  roles: 'List Roles',
};

function NavIcon({ name }: { name: 'patients' | 'categories' | 'operators' | 'users' | 'roles' }) {
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
  if (name === 'users') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (name === 'roles') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

interface DefaultScreenProps {
  me: Me;
  onLogout: () => void;
}

function DefaultScreen({ me, onLogout }: DefaultScreenProps) {
  const { t } = useTranslation();
  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }
  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <span className="breadcrumb-current">{t('app.title')}</span>
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
        <p className="empty-state">{t('default.noAccess')}</p>
      </main>
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const notify = useToast();
  const logoUrl = useSyncExternalStore(subscribeLogo, getLogoUrl);
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
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
    if (!me) {
      setPermissions(null);
      setSection('patients');
      return;
    }
    let cancelled = false;
    myPermissions()
      .then((perms) => {
        if (cancelled) return;
        setPermissions(perms);
        const available = (Object.keys(SECTION_PERMISSION) as Section[]).find(
          (sec) => perms.has(SECTION_PERMISSION[sec])
        );
        if (available) setSection(available);
      })
      .catch(() => {
        if (cancelled) return;
        setPermissions(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [me]);

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

  const hasSection = (sec: Section) =>
    permissions === null || permissions.has(SECTION_PERMISSION[sec]);

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
  } else if (section === 'categories' && hasSection('categories')) {
    content = <Categories me={me} onLogout={handleLogout} />;
  } else if (section === 'operators' && hasSection('operators')) {
    content = <Operators me={me} onLogout={handleLogout} />;
  } else if (section === 'users' && hasSection('users')) {
    content = <Users me={me} onLogout={handleLogout} />;
  } else if (section === 'roles' && hasSection('roles')) {
    content = <Roles me={me} onLogout={handleLogout} />;
  } else if (section === 'patients' && hasSection('patients')) {
    content = <Patients me={me} onLogout={handleLogout} onSelectPatient={setSelectedPatient} />;
  } else {
    content = <DefaultScreen me={me} onLogout={handleLogout} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {logoUrl ? <img className="sidebar-logo" src={logoUrl} alt="" /> : t('app.title')}
        </div>
        <nav className="sidebar-nav">
          {(Object.keys(SECTION_PERMISSION) as Section[]).map((sec) =>
            hasSection(sec) ? (
              <button
                key={sec}
                type="button"
                className={`sidebar-link${section === sec ? ' sidebar-link-active' : ''}`}
                onClick={() => goToSection(sec)}
              >
                <NavIcon name={sec} />
                {t(`nav.${sec}`)}
              </button>
            ) : null
          )}
        </nav>
      </aside>
      <div className="app-content">{content}</div>
    </div>
  );
}
