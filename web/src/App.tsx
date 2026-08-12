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
