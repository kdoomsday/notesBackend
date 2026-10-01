import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type PatientNote } from '../api/client';
import { serverErrorMessage } from '../i18n';

interface PatientNotesModalProps {
  patientId: string;
  patientName: string;
  canSet: boolean;
  canDelete: boolean;
  onClose: () => void;
}

function bySortOrder(a: PatientNote, b: PatientNote): number {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

/* The server keeps whatever `sortOrder` it is given, so the list is renumbered
 * from its position after every change instead of accumulating gaps. */
function renumber(list: PatientNote[]): PatientNote[] {
  return list.map((note, index) => (note.sortOrder === index ? note : { ...note, sortOrder: index }));
}

export default function PatientNotesModal({
  patientId,
  patientName,
  canSet,
  canDelete,
  onClose,
}: PatientNotesModalProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<PatientNote[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .patientNotes(patientId)
      .then((list) => {
        if (cancelled) return;
        setNotes(list.slice().sort(bySortOrder));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setNotes([]);
          return;
        }
        setNotes([]);
        setLoadError(serverErrorMessage(err) || t('patientNotes.loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, t]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (editingId !== null) {
        setEditingId(null);
        return;
      }
      onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingId, onClose]);

  const busy = creating || saving || deletingId !== null;

  function errorFor(err: unknown, fallback: string): string {
    if (err instanceof ApiError && err.status === 401) return t('errors.unauthorized');
    return serverErrorMessage(err) || fallback;
  }

  async function handleCreate() {
    const text = newText.trim();
    if (!text || busy) return;
    setActionError('');
    setCreating(true);
    try {
      const created = await authApi.createPatientNote(patientId, {
        notes: text,
        sortOrder: notes?.length ?? 0,
      });
      setNotes((prev) => renumber([...(prev ?? []), created]));
      setNewText('');
    } catch (err) {
      setActionError(errorFor(err, t('patientNotes.createFailed')));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(note: PatientNote) {
    setActionError('');
    setEditingId(note.id);
    setEditText(note.notes);
  }

  async function handleSaveEdit() {
    const text = editText.trim();
    const current = (notes ?? []).find((n) => n.id === editingId);
    if (current === undefined) return;
    if (text && text !== current.notes && !busy) {
      setActionError('');
      setSaving(true);
      try {
        const updated = await authApi.updatePatientNote(patientId, current.id, {
          notes: text,
          sortOrder: current.sortOrder,
        });
        setNotes((prev) =>
          (prev ?? []).map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
        );
        setEditingId(null);
      } catch (err) {
        setActionError(errorFor(err, t('patientNotes.updateFailed')));
      } finally {
        setSaving(false);
      }
      return;
    }
    setEditingId(null);
  }

  async function handleDelete(note: PatientNote) {
    if (busy) return;
    setActionError('');
    setDeletingId(note.id);
    try {
      await authApi.deletePatientNote(patientId, note.id);
      setNotes((prev) => renumber((prev ?? []).filter((n) => n.id !== note.id)));
    } catch (err) {
      setActionError(errorFor(err, t('patientNotes.deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  }

  /* The server takes the full order, so a move sends every id and a failed move
   * reloads the order from the server instead of leaving the list out of sync. */
  async function applyOrder(next: number[]) {
    setActionError('');
    try {
      await authApi.reorderPatientNotes(patientId, next);
    } catch (err) {
      setActionError(errorFor(err, t('patientNotes.reorderFailed')));
      try {
        const fresh = await authApi.patientNotes(patientId);
        setNotes(fresh.slice().sort(bySortOrder));
      } catch {
        // Keep the order as it was before the failed move.
      }
    }
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    const current = notes ?? [];
    if (target < 0 || target >= current.length) return;
    const next = current.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setNotes(renumber(next));
    void applyOrder(next.map((n) => n.id));
  }

  function drop(from: number, to: number) {
    const current = notes ?? [];
    if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
      setDraggedIndex(null);
      return;
    }
    const next = current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setNotes(renumber(next));
    setDraggedIndex(null);
    void applyOrder(next.map((n) => n.id));
  }

  const list = notes ?? [];
  const message = actionError || loadError;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        style={{ width: 'min(920px, 95vw)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-notes-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="patient-notes-title" className="modal-title">
          {t('patientNotes.title', { name: patientName })}
        </h3>
        <p className="modal-text">{t('patientNotes.instructions')}</p>
        {message && <p className="error modal-error">{message}</p>}
        {notes === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : list.length === 0 ? (
          <p className="empty-state">{t('patientNotes.empty')}</p>
        ) : (
          <ul
            className="reorder-list"
            onDrop={(event) => {
              event.preventDefault();
              setDraggedIndex(null);
            }}
            onDragOver={(event) => event.preventDefault()}
          >
            {list.map((note, index) => (
              <li
                key={note.id}
                className={'reorder-item' + (draggedIndex === index ? ' reorder-item-current' : '')}
                draggable={editingId !== note.id && !busy}
                onDragStart={(event) => {
                  setDraggedIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(note.id));
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedIndex === null) return;
                  drop(draggedIndex, index);
                }}
                onDragEnd={() => setDraggedIndex(null)}
              >
                {editingId === note.id ? (
                  <>
                    <textarea
                      className="patient-note-input"
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          void handleSaveEdit();
                        }
                      }}
                      autoFocus
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      title={t('common.cancel')}
                      aria-label={t('common.cancel')}
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      title={t('patientNotes.save')}
                      aria-label={t('patientNotes.save')}
                      disabled={saving || !editText.trim()}
                      onClick={() => void handleSaveEdit()}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                     <span className="patient-note-text">{note.notes}</span>
                     {canSet && (
                       <button
                         type="button"
                         className="icon-btn icon-btn-sm"
                         title={t('patientNotes.edit')}
                         aria-label={t('patientNotes.edit')}
                         disabled={busy}
                         onClick={() => startEdit(note)}
                       >
                         <svg
                           width="16"
                           height="16"
                           viewBox="0 0 24 24"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="2"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                           aria-hidden="true"
                         >
                           <path d="M12 20h9" />
                           <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                         </svg>
                       </button>
                     )}
                     {canDelete && (
                       <button
                         type="button"
                         className="icon-btn icon-btn-sm icon-btn-danger"
                         title={t('patientNotes.delete')}
                         aria-label={t('patientNotes.delete')}
                         disabled={busy}
                         onClick={() => void handleDelete(note)}
                       >
                         <svg
                           width="16"
                           height="16"
                           viewBox="0 0 24 24"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="2"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                           aria-hidden="true"
                         >
                           <path d="M3 6h18" />
                           <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                           <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                         </svg>
                       </button>
                     )}
                     {canSet && (
                       <>
                         <button
                           type="button"
                           className="icon-btn icon-btn-sm"
                           title={t('patientNotes.moveUp')}
                           aria-label={t('patientNotes.moveUp')}
                           disabled={busy || index === 0}
                           onClick={() => move(index, -1)}
                         >
                           <svg
                             width="16"
                             height="16"
                             viewBox="0 0 24 24"
                             fill="none"
                             stroke="currentColor"
                             strokeWidth="2"
                             strokeLinecap="round"
                             strokeLinejoin="round"
                             aria-hidden="true"
                           >
                             <path d="m18 15-6-6-6 6" />
                           </svg>
                         </button>
                         <button
                           type="button"
                           className="icon-btn icon-btn-sm"
                           title={t('patientNotes.moveDown')}
                           aria-label={t('patientNotes.moveDown')}
                           disabled={busy || index === list.length - 1}
                           onClick={() => move(index, 1)}
                         >
                           <svg
                             width="16"
                             height="16"
                             viewBox="0 0 24 24"
                             fill="none"
                             stroke="currentColor"
                             strokeWidth="2"
                             strokeLinecap="round"
                             strokeLinejoin="round"
                             aria-hidden="true"
                           >
                             <path d="m6 9 6 6 6-6" />
                           </svg>
                         </button>
                       </>
                     )}
                  </>
                )}
                <svg
                  className="reorder-drag-handle"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="6" r="1" />
                  <circle cx="15" cy="6" r="1" />
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="9" cy="18" r="1" />
                  <circle cx="15" cy="18" r="1" />
                </svg>
              </li>
            ))}
          </ul>
        )}
        {canSet && (
          <div className="patient-note-add">
            <textarea
              className="patient-note-input"
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder={t('patientNotes.textPlaceholder')}
              rows={3}
              disabled={creating}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCreate()}
              disabled={creating || busy || !newText.trim()}
            >
              {creating ? t('patientNotes.creating') : t('patientNotes.add')}
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

