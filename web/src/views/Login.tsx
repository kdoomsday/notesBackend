import { useState, type FormEvent } from 'react';
import { authApi, type Me } from '../api/client';

interface LoginProps {
  onLogin: (me: Me) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const me = await authApi.login(name.trim(), password);
      onLogin(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view login-view">
      <div className="login-card">
        <div className="login-logo">N</div>
        <h1 className="login-title">Notes</h1>
        <p className="login-subtitle">Sign in with your name and password</p>
        <form onSubmit={handleSubmit} autoComplete="off">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="e.g. admin"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="error login-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
