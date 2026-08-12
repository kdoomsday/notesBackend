import { useCallback, useEffect, useState } from 'react';
import { authApi, type Me, type Patient } from './api/client';
import Login from './views/Login';
import Patients from './views/Patients';
import Shifts from './views/Shifts';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const handleLogout = useCallback(() => {
    setMe(null);
    setSelectedPatient(null);
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

  if (selectedPatient) {
    return (
      <Shifts
        me={me}
        patient={selectedPatient}
        onBack={() => setSelectedPatient(null)}
        onLogout={handleLogout}
      />
    );
  }

  return <Patients me={me} onLogout={handleLogout} onSelectPatient={setSelectedPatient} />;
}
