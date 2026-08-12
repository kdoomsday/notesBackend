import { useCallback, useEffect, useState } from 'react';
import { authApi, type Me } from './api/client';
import Login from './views/Login';
import Patients from './views/Patients';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  const handleLogout = useCallback(() => setMe(null), []);

  useEffect(() => {
    authApi
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;

  if (!me) return <Login onLogin={setMe} />;

  return <Patients me={me} onLogout={handleLogout} />;
}
