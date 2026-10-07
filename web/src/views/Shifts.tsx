import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type Me, type Patient, type PatientInfo, type Shift, type TimeBlock } from '../api/client';
import { serverErrorMessage } from '../i18n';
import BackLink from '../components/BackLink';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PatientNotesModal from '../components/PatientNotesModal';

interface ShiftsProps {
  me: Me;
  patient: Patient;
  canListNotes: boolean;
  canSetNotes: boolean;
  canDeleteNotes: boolean;
  onBack: () => void;
  onPatientDeleted: () => void;
  onPatientUpdated: (patient: Patient) => void;
  onSelectShift: (shift: Shift, orderedShifts: Shift[]) => void;
  onLogout: () => void;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function isTimeInBlock(nowMinutes: number, start: string, end: string): boolean {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftComparer(timeBlocks: TimeBlock[], dateDirection: 1 | -1) {
  return (a: Shift, b: Shift): number => {
    const byDate = dateDirection * a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate; // Dates are different, this wins
    const aStart = timeBlocks.find((tb) => tb.id === a.timeBlockId)?.startTime ?? '';
    const bStart = timeBlocks.find((tb) => tb.id === b.timeBlockId)?.startTime ?? '';
    return aStart.localeCompare(bStart);
  };
}

export default function Shifts({
  me,
  patient,
  canListNotes,
  canSetNotes,
  canDeleteNotes,
  onBack,
  onPatientDeleted,
  onPatientUpdated,
  onSelectShift,
  onLogout,
}: ShiftsProps) {
  const { t, i18n } = useTranslation();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [info, setInfo] = useState<PatientInfo | null>(null);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNames, setEditNames] = useState('');
  const [editLastNames, setEditLastNames] = useState('');
  const [editHistoryNumber, setEditHistoryNumber] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [editInfoError, setEditInfoError] = useState('');
  const [editDirty, setEditDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    authApi
      .patientInfo(patient.id)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  const loadNoteCount = useCallback(() => {
    if (!canListNotes) {
      setNoteCount(null);
      return;
    }
    authApi
      .patientNotes(patient.id)
      .then((list) => setNoteCount(list.length))
      .catch(() => setNoteCount(null));
  }, [canListNotes, patient.id]);

  useEffect(() => {
    loadNoteCount();
  }, [loadNoteCount]);

  function closeNotes() {
    setShowNotes(false);
    loadNoteCount();
  }

  useEffect(() => {
    if (!showDelete) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowDelete(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDelete]);

  useEffect(() => {
    if (!showEditInfo) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowEditInfo(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showEditInfo]);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    Promise.all([authApi.shifts(), authApi.timeBlocks()])
      .then(([allShifts, blocks]) => {
        if (cancelled) return;
        setShifts(allShifts);
        setTimeBlocks(blocks.filter((b) => !b.deleted));

        const since = allShifts.reduce((max, s) => Math.max(max, s.updatedAt), 0);
        source = new EventSource(`/api/shifts/stream?since=${since}`);
        source.addEventListener('shift', (event) => {
          let shift: Shift;
          try {
            shift = JSON.parse((event as MessageEvent).data) as Shift;
          } catch {
            return;
          }
          setShifts((prev) => {
            if (!prev) return prev;
            const index = prev.findIndex((s) => s.id === shift.id);
            if (index === -1) return [...prev, shift];
            if (prev[index].updatedAt >= shift.updatedAt) return prev;
            const next = prev.slice();
            next[index] = shift;
            return next;
          });
        });
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setShifts([]);
          setTimeBlocks([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('shifts.title') }));
      });

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [t]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentBlockId = timeBlocks.find((tb) => isTimeInBlock(nowMinutes, tb.startTime, tb.endTime))?.id;

  const patientShifts = (shifts ?? [])
    .filter((s) => s.patientId === patient.id)
    .sort(shiftComparer(timeBlocks, -1));

  const byDate = new Map<string, Shift[]>();
  for (const shift of patientShifts) {
    const list = byDate.get(shift.date) ?? [];
    list.push(shift);
    byDate.set(shift.date, list);
  }

  const orderedShifts = [...patientShifts].sort(shiftComparer(timeBlocks, 1));

  function openDelete() {
    setDeleteError('');
    setShowDelete(true);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await authApi.deletePatient(patient.id);
      onPatientDeleted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setDeleteError(t('errors.unauthorized'));
        return;
      }
      setDeleteError(serverErrorMessage(err) || t('patients.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  function openEditInfo() {
    setEditName(patient.name);
    setEditNames(info?.names ?? '');
    setEditLastNames(info?.lastNames ?? '');
    setEditHistoryNumber(info?.historyNumber ?? '');
    setEditDirty(false);
    setEditInfoError('');
    setShowEditInfo(true);
  }

  // The info may still be loading when the user opens the modal, so prefill the
  // fields as soon as it arrives. Once the user starts typing, their input wins.
  useEffect(() => {
    if (!showEditInfo || editDirty) return;
    setEditNames(info?.names ?? '');
    setEditLastNames(info?.lastNames ?? '');
    setEditHistoryNumber(info?.historyNumber ?? '');
  }, [showEditInfo, info, editDirty]);

  async function handleSaveInfo(event: FormEvent) {
    event.preventDefault();
    const displayName = editName.trim();
    const names = editNames.trim();
    const lastNames = editLastNames.trim();
    const historyNumber = editHistoryNumber.trim();
    if (!displayName || !names || !lastNames || !historyNumber || savingInfo) return;
    setEditInfoError('');
    setSavingInfo(true);
    try {
      const saved = await authApi.updatePatient(patient.id, {
        displayName,
        names,
        lastNames,
        historyNumber,
      });
      setInfo({
        patientId: patient.id,
        names,
        lastNames,
        historyNumber,
        updatedAt: saved.updatedAt,
        deleted: false,
      });
      setShowEditInfo(false);
      onPatientUpdated(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setEditInfoError(t('errors.unauthorized'));
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setEditInfoError(t('patients.alreadyExists'));
        return;
      }
      setEditInfoError(serverErrorMessage(err) || t('patients.saveInfoFailed'));
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }

  const infoLine = info
    ? [
        [info.names, info.lastNames].filter(Boolean).join(' '),
        info.historyNumber ? t('patients.historyNumberValue', { value: info.historyNumber }) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <button type="button" className="crumb-link" onClick={onBack}>
              {t('nav.patients')}
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{patient.name}</span>
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
        <BackLink label={t('shifts.backToPatients')} onClick={onBack} />
        <div className="section-head section-head-row">
          <div>
            <h2>{patient.name}</h2>
            {infoLine && <p className="patient-detail">{infoLine}</p>}
            <p className="section-subtitle">{t('shifts.title')} · {t('shifts.count', { count: patientShifts.length })}</p>
          </div>
          <div className="section-head-actions">
            {canListNotes && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowNotes(true)}
                title={t('patientNotes.button')}
              >
                {t('patientNotes.button')}
                {noteCount !== null && noteCount > 0 && (
                  <span className="note-count-badge">{noteCount}</span>
                )}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={openEditInfo}
              title={t('patients.editInfo')}
            >
              {t('patients.editInfo')}
            </button>
            <button type="button" className="btn btn-danger" onClick={openDelete}>
              {t('patients.delete')}
            </button>
          </div>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {shifts === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : patientShifts.length === 0 ? (
          <p className="empty-state">{t('shifts.empty')}</p>
        ) : (
          Array.from(byDate.entries()).map(([date, dayShifts]) => (
            <section key={date} className="shift-date">
              <h3 className="shift-date-title">{formatDate(date, i18n.language)}</h3>
              <div className="shift-grid">
                {dayShifts.map((shift) => {
                  const block = timeBlocks.find((tb) => tb.id === shift.timeBlockId);
                  const isCurrent = shift.date === todayString() && shift.timeBlockId === currentBlockId;
                  return (
                    <button
                      type="button"
                      key={shift.id}
                      className={`shift-card${isCurrent ? ' shift-card-current' : ''}`}
                      title={t('shifts.viewNotes', { block: block?.name ?? t('common.shift') })}
                      onClick={() => onSelectShift(shift, orderedShifts)}
                    >
                      <span className="shift-block">{block?.name ?? t('common.shift')}</span>
                      <span className="shift-time">
                        {block ? `${block.startTime} – ${block.endTime}` : ''}
                      </span>
                      {isCurrent && <span className="shift-current-tag">{t('shifts.current')}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
        {showDelete && (
          <div className="modal-backdrop" onClick={() => setShowDelete(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-patient-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="delete-patient-title" className="modal-title">
                {t('patients.deleteTitle')}
              </h3>
              <p className="modal-text">{t('patients.deleteConfirm', { name: patient.name })}</p>
              {deleteError && <p className="error modal-error">{deleteError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('patients.deleting') : t('patients.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
        {showEditInfo && (
          <div className="modal-backdrop" onClick={() => setShowEditInfo(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-info-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="edit-info-title" className="modal-title">
                {t('patients.editInfoTitle')}
              </h3>
              <form onSubmit={handleSaveInfo}>
                <label className="field">
                  <span>{t('patients.name')}</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('patients.namePlaceholder')}
                    autoFocus
                    disabled={savingInfo}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t('patients.names')}</span>
                  <input
                    type="text"
                    value={editNames}
                    onChange={(e) => {
                      setEditNames(e.target.value);
                      setEditDirty(true);
                    }}
                    placeholder={t('patients.namesPlaceholder')}
                    disabled={savingInfo}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t('patients.lastNames')}</span>
                  <input
                    type="text"
                    value={editLastNames}
                    onChange={(e) => {
                      setEditLastNames(e.target.value);
                      setEditDirty(true);
                    }}
                    placeholder={t('patients.lastNamesPlaceholder')}
                    disabled={savingInfo}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t('patients.historyNumber')}</span>
                  <input
                    type="text"
                    value={editHistoryNumber}
                    onChange={(e) => {
                      setEditHistoryNumber(e.target.value);
                      setEditDirty(true);
                    }}
                    placeholder={t('patients.historyNumberPlaceholder')}
                    disabled={savingInfo}
                    required
                  />
                </label>
                {editInfoError && <p className="error modal-error">{editInfoError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowEditInfo(false)}
                    disabled={savingInfo}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingInfo || !editName.trim() || !editNames.trim() || !editLastNames.trim() || !editHistoryNumber.trim()}
                  >
                    {savingInfo ? t('patients.savingInfo') : t('patients.saveInfo')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showNotes && (
          <PatientNotesModal
            patientId={patient.id}
            patientName={patient.name}
            canSet={canSetNotes}
            canDelete={canDeleteNotes}
            onClose={closeNotes}
          />
        )}
      </main>
    </div>
  );
}
