import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  authApi,
  notePhotoUrl,
  type Note,
  type NotePhoto,
  type NoteUpdate,
} from '../api/client';
import { serverErrorMessage } from '../i18n';
import CategoryIcon from './CategoryIcon';

interface NoteCardProps {
  note: Note;
  authorName: string;
  operatorName: (id: number) => string;
  onLogout: () => void;
}

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PhotoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
      <circle cx="7" cy="8" r="1.25" />
      <path d="M2.5 14.5l4-4.5 3.5 3.5 2.5-2.5 5 5" />
    </svg>
  );
}

function Chevron() {
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
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="6.75" />
      <path d="M10 6v4l2.75 1.75" />
    </svg>
  );
}

export default function NoteCard({ note, authorName, operatorName, onLogout }: NoteCardProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [photos, setPhotos] = useState<NotePhoto[] | null>(null);
  const [error, setError] = useState('');
  const [viewPhoto, setViewPhoto] = useState<NotePhoto | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<NoteUpdate[] | null>(null);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    authApi
      .notePhotos(note.id)
      .then((list) => {
        if (cancelled) return;
        setPhotos(list.filter((photo) => !photo.deleted));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setPhotos([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('notes.photos') }));
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, note.id, t]);

  useEffect(() => {
    if (!viewPhoto) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setViewPhoto(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewPhoto]);

  useEffect(() => {
    if (!showHistory) return;
    let cancelled = false;
    setHistoryError('');
    authApi
      .noteUpdates(note.id)
      .then((list) => {
        if (cancelled) return;
        setHistory(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setHistory([]);
          return;
        }
        setHistoryError(
          serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('notes.history') })
        );
      });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowHistory(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [note.id, showHistory, t]);

  function openHistory() {
    setHistory(null);
    setShowHistory(true);
  }

  function toggle() {
    setExpanded((prev) => !prev);
  }

  return (
    <div
      className={`note-card${expanded ? ' note-card-expanded' : ''}${note.deleted ? ' note-card-deleted' : ''}`}
      onClick={toggle}
    >
      <div className="note-card-header">
        <div className="note-meta">
          <span className="note-date">{formatDateTime(note.noteDate, i18n.language)}</span>
          {note.deleted && <span className="note-deleted-tag">{t('notes.deleted')}</span>}
          {note.category && (
            <span className="note-category">
              <CategoryIcon iconName={note.category.iconName} />
              {note.category.name}
            </span>
          )}
          {authorName && <span className="note-author">{authorName}</span>}
          {!!note.photoCount && (
            <span
              className="note-photo-count"
              title={t('notes.photoCount', { count: note.photoCount })}
            >
              <PhotoIcon />
              {note.photoCount}
            </span>
          )}
        </div>
        <div className="note-card-actions">
          <button
            type="button"
            className="note-card-toggle"
            aria-label={t('notes.showHistory')}
            title={t('notes.showHistory')}
            onClick={(event) => {
              event.stopPropagation();
              openHistory();
            }}
          >
            <HistoryIcon />
          </button>
          <button
            type="button"
            className="note-card-toggle"
            aria-expanded={expanded}
            aria-label={t('notes.details')}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            <Chevron />
          </button>
        </div>
      </div>
      <p className="note-text">{note.text}</p>
      {expanded && (
        <div className="note-details">
          <div className="note-detail">
            <span className="note-detail-label">{t('notes.author')}</span>
            <span className="note-detail-value">{authorName || t('notes.unknownAuthor')}</span>
          </div>
          <div className="note-detail">
            <span className="note-detail-label">{t('notes.updated')}</span>
            <span className="note-detail-value">{formatDateTime(note.updatedAt, i18n.language)}</span>
          </div>
          <div className="note-detail">
            <span className="note-detail-label">{t('notes.photos')}</span>
            <span className="note-detail-value">
              {photos === null ? (
                t('common.loading')
              ) : photos.length === 0 ? (
                t('notes.noPhotos')
              ) : (
                <span className="photo-list">
                  {photos.map((photo) => (
                    <button
                      type="button"
                      key={photo.id}
                      className="photo-icon"
                      title={photo.origName}
                      aria-label={t('notes.showPhoto', { name: photo.origName })}
                      onClick={(event) => {
                        event.stopPropagation();
                        setViewPhoto(photo);
                      }}
                    >
                      <PhotoIcon />
                    </button>
                  ))}
                </span>
              )}
            </span>
          </div>
          {error && <p className="error note-detail-error">{error}</p>}
        </div>
      )}
      {viewPhoto && (
        <div className="modal-backdrop" onClick={() => setViewPhoto(null)}>
          <div
            className="modal photo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="photo-modal-title" className="modal-title">
              {viewPhoto.origName}
            </h3>
            <img
              className="photo-full"
              src={notePhotoUrl(note.id, viewPhoto.id)}
              alt={viewPhoto.origName}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewPhoto(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
          <div
            className="modal history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="history-modal-title" className="modal-title">
              {t('notes.history')}
            </h3>
            {history === null ? (
              <p className="modal-text">{t('common.loading')}</p>
            ) : history.length === 0 ? (
              <p className="modal-text">{t('notes.noHistory')}</p>
            ) : (
              <ul className="history-list">
                {history.map((entry) => (
                  <li key={entry.id} className="history-item">
                    <span className="history-item-meta">
                      {formatDateTime(entry.updatedAt, i18n.language)} ·{' '}
                      {operatorName(entry.updatedBy) || t('notes.unknownAuthor')}
                    </span>
                    <span className="history-item-changes">{entry.changes}</span>
                  </li>
                ))}
              </ul>
            )}
            {historyError && <p className="error modal-error">{historyError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowHistory(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
