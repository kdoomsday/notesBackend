import { useEffect, useState } from 'react';
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
import CategoryIcon from '../components/CategoryIcon';

interface NotesProps {
  me: Me;
  patient: Patient;
  shift: Shift;
  onBack: () => void;
  onBackToPatients: () => void;
  onLogout: () => void;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Notes({ me, patient, shift, onBack, onBackToPatients, onLogout }: NotesProps) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([authApi.notes(), authApi.timeBlocks(), authApi.operators()])
      .then(([allNotes, blocks, ops]) => {
        setNotes(allNotes.filter((n) => !n.deleted && n.shiftId === shift.id));
        setTimeBlocks(blocks.filter((b) => !b.deleted));
        setOperators(ops.filter((o) => !o.deleted));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load notes');
      });
  }, [onLogout, shift.id]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }

  const shiftNotes = (notes ?? [])
    .slice()
    .sort((a, b) => a.noteDate.localeCompare(b.noteDate));

  const block = timeBlocks.find((tb) => tb.id === shift.timeBlockId);
  const shiftLabel = block ? `${block.name} · ${formatDate(shift.date)}` : formatDate(shift.date);

  function operatorName(id: number): string {
    return operators.find((o) => o.id === id)?.name ?? '';
  }

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <button type="button" className="crumb-link" onClick={onBackToPatients}>
              Patients
            </button>
            <span className="breadcrumb-sep">/</span>
            <button type="button" className="crumb-link" onClick={onBack}>
              {patient.name}
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{shiftLabel}</span>
          </div>
          <div className="user-area">
            <span className="user-name">{me.name}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="section-head">
          <h2>Notes</h2>
          <p className="section-subtitle">
            {notes === null
              ? 'Loading…'
              : shiftNotes.length === 1
                ? '1 note'
                : `${shiftNotes.length} notes`}
          </p>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {notes === null ? (
          <p className="section-subtitle">Loading…</p>
        ) : shiftNotes.length === 0 ? (
          <p className="empty-state">No notes for this shift yet.</p>
        ) : (
          <div className="notes-list">
            {shiftNotes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-meta">
                  <span className="note-date">{formatDateTime(note.noteDate)}</span>
                  {note.category && (
                    <span className="note-category">
                      <CategoryIcon iconName={note.category.iconName} />
                      {note.category.name}
                    </span>
                  )}
                  <span className="note-author">{operatorName(note.createdBy)}</span>
                </div>
                <p className="note-text">{note.text}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
