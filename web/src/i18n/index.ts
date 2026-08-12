import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

export type Language = 'en' | 'es';

const STORAGE_KEY = 'lang';

function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // Ignore storage access errors.
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'es'],
  interpolation: {
    escapeValue: false,
  },
});

function applyLanguage(lng: string) {
  document.title = i18n.t('app.title');
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Ignore storage access errors.
  }
}

i18n.on('languageChanged', applyLanguage);
if (i18n.isInitialized) {
  applyLanguage(i18n.language);
} else {
  i18n.on('initialized', () => applyLanguage(i18n.language));
}

export function serverErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'Invalid name or password') return i18n.t('errors.invalidCredentials');
    if (err.message === 'Could not reach the notes server') return i18n.t('errors.serverUnreachable');
    if (err.message === 'Name and password are required') return i18n.t('errors.missingCredentials');
    return err.message;
  }
  return '';
}

export default i18n;
