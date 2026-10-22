import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, myPermissions, type Me, type Patient, type Shift } from './api/client';
import { serverErrorMessage } from './i18n';
import { SECTIONS, sectionOf, useHashRoute, type Section } from './routing';
import { orderedPatientShifts } from './shiftUtils';
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

const SECTION_PERMISSION: Record<Section, string> = {
  patients: 'List Patients',
  categories: 'List Categories',
  operators: 'List Operators',
  users: 'List Users',
  roles: 'List Roles',
};

function NavIcon({ name }: { name: Section }) {
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

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="view">
      <main className="app-main">
        <p className="section-subtitle">{t('common.loading')}</p>
      </main>
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const notify = useToast();
  const logoUrl = useSyncExternalStore(subscribeLogo, getLogoUrl);
  const { route, navigate } = useHashRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedShiftList, setSelectedShiftList] = useState<Shift[]>([]);

  const routePatientId = route && route.kind !== 'section' ? route.patientId : null;
  const routeShiftId = route && route.kind === 'shift' ? route.shiftId : null;
  const section = route ? sectionOf(route) : 'patients';

  const handleLogout = useCallback(() => {
    setMe(null);
    setPermissions(null);
    setSelectedPatient(null);
    setSelectedShift(null);
    setSelectedShiftList([]);
    navigate({ kind: 'section', section: 'patients' }, { replace: true });
  }, [navigate]);

  const handlePatientDeleted = useCallback(() => {
    setSelectedPatient(null);
    setSelectedShift(null);
    setSelectedShiftList([]);
    navigate({ kind: 'section', section: 'patients' }, { replace: true });
    notify(t('patients.deleted'), 'warning');
  }, [navigate, notify, t]);

  const goToSection = useCallback(
    (next: Section) => {
      navigate({ kind: 'section', section: next });
    },
    [navigate]
  );

  const openPatient = useCallback(
    (patient: Patient) => {
      setSelectedPatient(patient);
      setSelectedShift(null);
      setSelectedShiftList([]);
      navigate({ kind: 'patient', patientId: patient.id });
    },
    [navigate]
  );

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
      return;
    }
    let cancelled = false;
    myPermissions()
      .then((perms) => {
        if (cancelled) return;
        setPermissions(perms);
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
    if (!me || permissions === null) return;
    const allowed = (sec: Section) => permissions.has(SECTION_PERMISSION[sec]);
    if (route && allowed(sectionOf(route))) return;
    const available = SECTIONS.find(allowed);
    if (available) {
      navigate({ kind: 'section', section: available }, { replace: true });
    }
  }, [me, permissions, route, navigate]);

  useEffect(() => {
    if (!me || permissions === null) return;

    if (!routePatientId) {
      if (selectedPatient !== null) setSelectedPatient(null);
      if (selectedShift !== null) setSelectedShift(null);
      if (selectedShiftList.length > 0) setSelectedShiftList([]);
      return;
    }

    if (!permissions.has(SECTION_PERMISSION.patients)) return;

    let cancelled = false;

    async function resolve() {
      let patient =
        selectedPatient && selectedPatient.id === routePatientId ? selectedPatient : null;

      if (!patient) {
        try {
          const patients = await authApi.patients();
          if (cancelled) return;
          patient = patients.find((p) => p.id === routePatientId && !p.deleted) ?? null;
        } catch (err) {
          if (cancelled) return;
          notify(
            serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('patients.title') }),
            'error'
          );
          navigate({ kind: 'section', section: 'patients' }, { replace: true });
          return;
        }
      }

      if (cancelled) return;
      if (!patient) {
        navigate({ kind: 'section', section: 'patients' }, { replace: true });
        return;
      }

      const resolvedPatient = patient;
      setSelectedPatient(resolvedPatient);

      if (!routeShiftId) {
        if (selectedShift !== null) setSelectedShift(null);
        if (selectedShiftList.length > 0) setSelectedShiftList([]);
        return;
      }

      if (
        selectedShift &&
        selectedShift.id === routeShiftId &&
        selectedShiftList.some((s) => s.id === routeShiftId)
      ) {
        return;
      }

      try {
        const [shifts, blocks] = await Promise.all([authApi.shifts(), authApi.timeBlocks()]);
        if (cancelled) return;
        const shift = shifts.find(
          (s) => s.id === routeShiftId && s.patientId === resolvedPatient.id
        );
        if (!shift) {
          navigate({ kind: 'patient', patientId: resolvedPatient.id }, { replace: true });
          return;
        }
        setSelectedShift(shift);
        setSelectedShiftList(
          orderedPatientShifts(
            shifts,
            blocks.filter((b) => !b.deleted),
            resolvedPatient.id
          )
        );
      } catch (err) {
        if (cancelled) return;
        notify(
          serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('shifts.title') }),
          'error'
        );
        navigate({ kind: 'patient', patientId: resolvedPatient.id }, { replace: true });
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [
    me,
    permissions,
    routePatientId,
    routeShiftId,
    selectedPatient,
    selectedShift,
    selectedShiftList,
    navigate,
    notify,
    t,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const el = document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      /* Views close their own modals on Escape, so the selection is only reset
       * once no modal is left open on top of it. */
      if (document.querySelector('.modal-backdrop')) return;
      if (routeShiftId && routePatientId) {
        navigate({ kind: 'patient', patientId: routePatientId }, { replace: true });
      } else if (routePatientId) {
        navigate({ kind: 'section', section: 'patients' }, { replace: true });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [routePatientId, routeShiftId, navigate]);

  if (checking) return null;

  if (!me) return <Login onLogin={setMe} />;

  const hasSection = (sec: Section) =>
    permissions !== null && permissions.has(SECTION_PERMISSION[sec]);

  let content: ReactNode;
  if (permissions === null) {
    content = <LoadingScreen />;
  } else if (!route) {
    const available = SECTIONS.find(hasSection);
    content = available ? <LoadingScreen /> : <DefaultScreen me={me} onLogout={handleLogout} />;
  } else if (route.kind === 'shift' && hasSection('patients')) {
    content =
      selectedPatient && selectedShift ? (
        <Notes
          me={me}
          patient={selectedPatient}
          shift={selectedShift}
          shifts={selectedShiftList}
          canSetPatientInfo={permissions.has('Set Patient Info')}
          onBack={() => navigate({ kind: 'patient', patientId: selectedPatient.id })}
          onBackToPatients={() => navigate({ kind: 'section', section: 'patients' })}
          onNavigateShift={(nextShift) => {
            setSelectedShift(nextShift);
            navigate({
              kind: 'shift',
              patientId: selectedPatient.id,
              shiftId: nextShift.id,
            });
          }}
          onPatientUpdated={setSelectedPatient}
          onLogout={handleLogout}
        />
      ) : (
        <LoadingScreen />
      );
  } else if (route.kind === 'patient' && hasSection('patients')) {
    content = selectedPatient ? (
      <Shifts
        me={me}
        patient={selectedPatient}
        canListNotes={permissions.has('List Patient Notes')}
        canSetNotes={permissions.has('Set Patient Notes')}
        canDeleteNotes={permissions.has('Delete Patient Notes')}
        canSetPatientInfo={permissions.has('Set Patient Info')}
        onBack={() => navigate({ kind: 'section', section: 'patients' })}
        onPatientDeleted={handlePatientDeleted}
        onPatientUpdated={setSelectedPatient}
        onSelectShift={(shift, orderedShifts) => {
          setSelectedShift(shift);
          setSelectedShiftList(orderedShifts);
          navigate({ kind: 'shift', patientId: selectedPatient.id, shiftId: shift.id });
        }}
        onLogout={handleLogout}
      />
    ) : (
      <LoadingScreen />
    );
  } else if (route.kind === 'section' && route.section === 'categories' && hasSection('categories')) {
    content = <Categories me={me} onLogout={handleLogout} />;
  } else if (route.kind === 'section' && route.section === 'operators' && hasSection('operators')) {
    content = <Operators me={me} onLogout={handleLogout} />;
  } else if (route.kind === 'section' && route.section === 'users' && hasSection('users')) {
    content = <Users me={me} onLogout={handleLogout} />;
  } else if (route.kind === 'section' && route.section === 'roles' && hasSection('roles')) {
    content = <Roles me={me} onLogout={handleLogout} />;
  } else if (route.kind === 'section' && route.section === 'patients' && hasSection('patients')) {
    content = <Patients me={me} onLogout={handleLogout} onSelectPatient={openPatient} />;
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
          {SECTIONS.map((sec) =>
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
