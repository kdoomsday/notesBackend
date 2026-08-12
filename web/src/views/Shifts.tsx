import { useEffect, useState } from 'react';
import { ApiError, authApi, type Me, type Patient, type Shift, type TimeBlock } from '../api/client';
import BackLink from '../components/BackLink';

interface ShiftsProps {
  me: Me;
  patient: Patient;
  onBack: () => void;
  onSelectShift: (shift: Shift, orderedShifts: Shift[]) => void;
  onLogout: () => void;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
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

export default function Shifts({ me, patient, onBack, onSelectShift, onLogout }: ShiftsProps) {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState('');

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
          onLogout();
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load shifts');
      });

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [onLogout]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentBlockId = timeBlocks.find((tb) => isTimeInBlock(nowMinutes, tb.startTime, tb.endTime))?.id;

  const patientShifts = (shifts ?? [])
    .filter((s) => s.patientId === patient.id)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      const aStart = timeBlocks.find((tb) => tb.id === a.timeBlockId)?.startTime ?? '';
      const bStart = timeBlocks.find((tb) => tb.id === b.timeBlockId)?.startTime ?? '';
      return aStart.localeCompare(bStart);
    });

  const byDate = new Map<string, Shift[]>();
  for (const shift of patientShifts) {
    const list = byDate.get(shift.date) ?? [];
    list.push(shift);
    byDate.set(shift.date, list);
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <button type="button" className="crumb-link" onClick={onBack}>
              Patients
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{patient.name}</span>
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
        <BackLink label="Back to Patients" onClick={onBack} />
        <div className="section-head">
          <h2>Shifts</h2>
          <p className="section-subtitle">
            {patientShifts.length === 1 ? '1 shift' : `${patientShifts.length} shifts`}
          </p>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {shifts === null ? (
          <p className="section-subtitle">Loading…</p>
        ) : patientShifts.length === 0 ? (
          <p className="empty-state">No shifts for this patient yet.</p>
        ) : (
          Array.from(byDate.entries()).map(([date, dayShifts]) => (
            <section key={date} className="shift-date">
              <h3 className="shift-date-title">{formatDate(date)}</h3>
              <div className="shift-grid">
                {dayShifts.map((shift) => {
                  const block = timeBlocks.find((tb) => tb.id === shift.timeBlockId);
                  const isCurrent = shift.date === todayString() && shift.timeBlockId === currentBlockId;
                  return (
                    <button
                      type="button"
                      key={shift.id}
                      className={`shift-card${isCurrent ? ' shift-card-current' : ''}`}
                      title={`${block?.name ?? 'Shift'} — view notes`}
                      onClick={() => onSelectShift(shift, patientShifts)}
                    >
                      <span className="shift-block">{block?.name ?? 'Shift'}</span>
                      <span className="shift-time">
                        {block ? `${block.startTime} – ${block.endTime}` : ''}
                      </span>
                      {isCurrent && <span className="shift-current-tag">Current</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
