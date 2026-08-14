import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  authApi,
  type Me,
  type Note,
  type Operator,
  type Patient,
  type Shift,
  type TimeBlock,
} from '../api/client';
import { serverErrorMessage } from '../i18n';
import NoteCard from '../components/NoteCard';
import CategoryValuesModal from '../components/CategoryValuesModal';
import BackLink from '../components/BackLink';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface NotesProps {
  me: Me;
  patient: Patient;
  shift: Shift;
  shifts: Shift[];
  onBack: () => void;
  onBackToPatients: () => void;
  onNavigateShift: (shift: Shift) => void;
  onLogout: () => void;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? (
        <>
          <path d="M15 10H5" />
          <path d="M9 5l-5 5 5 5" />
        </>
      ) : (
        <>
          <path d="M5 10h10" />
          <path d="M11 5l5 5-5 5" />
        </>
      )}
    </svg>
  );
}

export default function Notes({
  me,
  patient,
  shift,
  shifts,
  onBack,
  onBackToPatients,
  onNavigateShift,
  onLogout,
}: NotesProps) {
  const { t, i18n } = useTranslation();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showValues, setShowValues] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    Promise.all([authApi.notes(), authApi.timeBlocks(), authApi.operators()])
      .then(([allNotes, blocks, ops]) => {
        if (cancelled) return;
        setNotes(allNotes.filter((n) => n.shiftId === shift.id));
        setTimeBlocks(blocks.filter((b) => !b.deleted));
        setOperators(ops.filter((o) => !o.deleted));

        const since =
          allNotes.reduce((max, n) => (n.updatedAt > max ? n.updatedAt : max), '') ||
          new Date(0).toISOString();
        source = new EventSource(`/api/notes/stream?since=${encodeURIComponent(since)}`);
        source.addEventListener('note', (event) => {
          let note: Note;
          try {
            note = JSON.parse((event as MessageEvent).data) as Note;
          } catch {
            return;
          }
          if (note.shiftId !== shift.id) return;
          setNotes((prev) => {
            if (!prev) return prev;
            return prev.some((n) => n.id === note.id)
              ? prev.map((n) => (n.id === note.id ? note : n))
              : [...prev, note];
          });
        });
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('notes.title') }));
      });

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [onLogout, shift.id, t]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }

  const hasDeleted = (notes ?? []).some((n) => n.deleted);

  const shiftNotes = (notes ?? [])
    .filter((n) => showDeleted || !n.deleted)
    .slice()
    .sort((a, b) =>
      a.deleted === b.deleted
        ? a.noteDate.localeCompare(b.noteDate)
        : a.deleted
          ? 1
          : -1
    );

  const block = timeBlocks.find((tb) => tb.id === shift.timeBlockId);
  const shiftLabel = block ? `${block.name} · ${formatDate(shift.date, i18n.language)}` : formatDate(shift.date, i18n.language);

  const shiftIndex = shifts.findIndex((s) => s.id === shift.id);
  const prevShift = shiftIndex > 0 ? shifts[shiftIndex - 1] : undefined;
  const nextShift = shiftIndex >= 0 && shiftIndex < shifts.length - 1 ? shifts[shiftIndex + 1] : undefined;

  function operatorName(id: number): string {
    return operators.find((o) => o.id === id)?.name ?? '';
  }

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <button type="button" className="crumb-link" onClick={onBackToPatients}>
              {t('nav.patients')}
            </button>
            <span className="breadcrumb-sep">/</span>
            <button type="button" className="crumb-link" onClick={onBack}>
              {patient.name}
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{shiftLabel}</span>
          </div>
          <div className="user-area">
            <LanguageSwitcher />
            <span className="user-name">{me.name}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              {t('nav.logOut')}
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <BackLink label={t('notes.backToShifts')} onClick={onBack} />
        <div className="section-head section-head-row">
          <div>
            <h2>{t('notes.title')}</h2>
            <p className="section-subtitle">
              {notes === null ? t('common.loading') : t('notes.count', { count: shiftNotes.length })}
            </p>
          </div>
          <div className="section-head-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowValues(true)}>
              {t('notes.values')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-pressed={showDeleted}
              onClick={() => setShowDeleted((prev) => !prev)}
            >
              {showDeleted ? t('notes.hideDeleted') : t('notes.showDeleted')}
            </button>
          </div>
        </div>
        <div className="shift-nav">
          <button
            type="button"
            className="btn btn-ghost shift-nav-btn"
            disabled={!prevShift}
            onClick={() => prevShift && onNavigateShift(prevShift)}
          >
            <Arrow direction="left" />
            {t('notes.previous')}
          </button>
          <span className="shift-nav-position">{shiftLabel}</span>
          <button
            type="button"
            className="btn btn-ghost shift-nav-btn"
            disabled={!nextShift}
            onClick={() => nextShift && onNavigateShift(nextShift)}
          >
            {t('notes.next')}
            <Arrow direction="right" />
          </button>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {notes === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : shiftNotes.length === 0 ? (
          <p className="empty-state">
            {hasDeleted && !showDeleted ? t('notes.noActive') : t('notes.empty')}
          </p>
        ) : (
          <div className="notes-list">
            {shiftNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                authorName={operatorName(note.createdBy)}
                operatorName={operatorName}
                onLogout={onLogout}
              />
            ))}
          </div>
        )}
      </main>
      {showValues && (
        <CategoryValuesModal
          patientId={patient.id}
          operatorName={operatorName}
          onLogout={onLogout}
          onClose={() => setShowValues(false)}
        />
      )}
    </div>
  );
}
