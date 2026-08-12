import { useCallback, useEffect, useState } from 'react';
import { authApi, type Me, type Patient, type Shift } from './api/client';
import Login from './views/Login';
import Patients from './views/Patients';
import Shifts from './views/Shifts';
import Notes from './views/Notes';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const handleLogout = useCallback(() => {
    setMe(null);
    setSelectedPatient(null);
    setSelectedShift(null);
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

  if (selectedPatient && selectedShift) {
    return (
      <Notes
        me={me}
        patient={selectedPatient}
        shift={selectedShift}
        onBack={() => setSelectedShift(null)}
        onBackToPatients={() => {
          setSelectedShift(null);
          setSelectedPatient(null);
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (selectedPatient) {
    return (
      <Shifts
        me={me}
        patient={selectedPatient}
        onBack={() => setSelectedPatient(null)}
        onSelectShift={setSelectedShift}
        onLogout={handleLogout}
      />
    );
  }

  return <Patients me={me} onLogout={handleLogout} onSelectPatient={setSelectedPatient} />;
}
