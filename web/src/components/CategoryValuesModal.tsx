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
import ValueChart, { type ValueChartPoint } from './ValueChart';

interface CategoryValuesModalProps {
  patientId: string;
  operatorName: (id: number) => string;
  onLogout: () => void;
  onClose: () => void;
}

const NOTE_COUNT_OPTIONS = [5, 10, 15];
const GRAPH_TYPES = ['line', 'bar', 'none'] as const;
type GraphType = (typeof GRAPH_TYPES)[number];

function extractNumericPoints(notes: Note[], fixedText?: string): ValueChartPoint[] {
  const points: ValueChartPoint[] = [];
  for (const note of notes) {
    let text = note.text;
    if (fixedText) {
      text = text.replace(fixedText, '');
    }
    text = text.trim().replace(',', '.');
    if (text === '') continue;
    const value = Number(text);
    if (!Number.isNaN(value)) points.push({ label: note.noteDate, value });
  }
  return points;
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

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
  const [amount, setAmount] = useState(NOTE_COUNT_OPTIONS[0]);
  const [graphType, setGraphType] = useState<GraphType>('line');
  const [error, setError] = useState('');

  const isNumeric = selected?.categoryType.type === 'Numeric';
  const numericPoints =
    isNumeric && values ? extractNumericPoints(values, selected?.fixedText) : [];
  const stats =
    numericPoints.length > 0
      ? {
          min: Math.min(...numericPoints.map((p) => p.value)),
          max: Math.max(...numericPoints.map((p) => p.value)),
          avg: numericPoints.reduce((sum, point) => sum + point.value, 0) / numericPoints.length,
        }
      : null;

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
          setCategories([]);
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
  }, [onClose, t]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setValues(null);
    setError('');
    authApi
      .lastNotesByCategory(patientId, selected.name, amount)
      .then((notes) => {
        if (cancelled) return;
        setValues(notes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setValues([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('notes.values') }));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, selected, amount, t]);

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
        {selected && (
          <div className="value-toolbar">
            {isNumeric && (
              <label className="value-select">
                <span>{t('notes.graph')}</span>
                <select
                  value={graphType}
                  onChange={(event) => setGraphType(event.target.value as GraphType)}
                >
                  {GRAPH_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {t(`notes.graph${option[0].toUpperCase()}${option.slice(1)}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="value-select">
              <span>{t('notes.amount')}</span>
              <select
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
              >
                {NOTE_COUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {selected && stats && (
          <div className="value-stats">
            <span>
              <strong>{t('notes.min')}</strong> {formatNumber(stats.min, i18n.language)}
            </span>
            <span>
              <strong>{t('notes.max')}</strong> {formatNumber(stats.max, i18n.language)}
            </span>
            <span>
              <strong>{t('notes.avg')}</strong> {formatNumber(stats.avg, i18n.language)}
            </span>
          </div>
        )}
        {selected && isNumeric && numericPoints.length > 0 && graphType !== 'none' && (
          <ValueChart points={numericPoints} type={graphType} locale={i18n.language} />
        )}
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
