import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, type Me } from '../api/client';
import { serverErrorMessage } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface LoginProps {
  onLogin: (me: Me) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation();
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
      setError(serverErrorMessage(err) || t('errors.signInFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view login-view">
      <div className="login-card">
        <div className="login-logo">N</div>
        <h1 className="login-title">{t('login.title')}</h1>
        <p className="login-subtitle">{t('login.subtitle')}</p>
        <div className="login-lang">
          <LanguageSwitcher />
        </div>
        <form onSubmit={handleSubmit} autoComplete="off">
          <label className="field">
            <span>{t('login.name')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder={t('login.namePlaceholder')}
              required
            />
          </label>
          <label className="field">
            <span>{t('login.password')}</span>
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
            {busy ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
