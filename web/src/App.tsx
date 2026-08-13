import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, type Me, type Patient, type Shift } from './api/client';
import { useToast } from './components/Toast';
import Login from './views/Login';
import Patients from './views/Patients';
import Shifts from './views/Shifts';
import Notes from './views/Notes';

export default function App() {
  const { t } = useTranslation();
  const notify = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedShiftList, setSelectedShiftList] = useState<Shift[]>([]);

  const handleLogout = useCallback(() => {
    setMe(null);
    setSelectedPatient(null);
    setSelectedShift(null);
    setSelectedShiftList([]);
  }, []);

  const handlePatientDeleted = useCallback(() => {
    setSelectedShift(null);
    setSelectedShiftList([]);
    setSelectedPatient(null);
    notify(t('patients.deleted'), 'warning');
  }, [notify, t]);

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
  }

  if (selectedPatient) {
    return (
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
  }

  return <Patients me={me} onLogout={handleLogout} onSelectPatient={setSelectedPatient} />;
}
