import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  authApi,
  type Category,
  type Note,
} from '../api/client';
import { serverErrorMessage } from '../i18n';
import CategoryIcon from './CategoryIcon';

interface CategoryValuesModalProps {
  patientId: string;
  operatorName: (id: number) => string;
  onLogout: () => void;
  onClose: () => void;
}

const LAST_NOTE_COUNT = 5;

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CategoryValuesModal({
  patientId,
  operatorName,
  onLogout,
  onClose,
}: CategoryValuesModalProps) {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selected, setSelected] = useState<Category | null>(null);
  const [values, setValues] = useState<Note[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    authApi
      .categories()
      .then((cats) => {
        if (cancelled) return;
        setCategories(cats.filter((c) => !c.deleted));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('notes.values') }));
      });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, onLogout, t]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setValues(null);
    setError('');
    authApi
      .lastNotesByCategory(patientId, selected.name, LAST_NOTE_COUNT)
      .then((notes) => {
        if (cancelled) return;
        setValues(notes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('notes.values') }));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, selected, onLogout, t]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal values-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="values-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="values-modal-title" className="modal-title">
          {selected ? selected.name : t('notes.chooseCategory')}
        </h3>
        {error && <p className="error modal-error">{error}</p>}
        {categories === null ? (
          <p className="modal-text">{t('common.loading')}</p>
        ) : !selected ? (
          <ul className="category-list">
            {categories.map((category) => (
              <li key={category.name}>
                <button
                  type="button"
                  className="category-item"
                  onClick={() => setSelected(category)}
                >
                  <CategoryIcon iconName={category.iconName} />
                  {category.name}
                </button>
              </li>
            ))}
          </ul>
        ) : values === null ? (
          <p className="modal-text">{t('common.loading')}</p>
        ) : values.length === 0 ? (
          <p className="modal-text">{t('notes.noValues')}</p>
        ) : (
          <ul className="value-list">
            {values.map((note) => (
              <li key={note.id} className="value-item">
                <span className="value-item-date">{formatDate(note.noteDate, i18n.language)}</span>
                <span className="value-item-text">{note.text}</span>
                <span className="value-item-author">{operatorName(note.createdBy)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          {selected && (
            <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
              {t('notes.backToCategories')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
