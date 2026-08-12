import { useTranslation } from 'react-i18next';
import type { Language } from '../i18n';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language?.startsWith('es') ? 'es' : 'en';

  return (
    <select
      className="language-select"
      value={language}
      aria-label={t('common.language')}
      onChange={(event) => {
        void i18n.changeLanguage(event.target.value);
      }}
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}
