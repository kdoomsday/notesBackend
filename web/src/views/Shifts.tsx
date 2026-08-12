import { useEffect, useState } from 'react';
import { ApiError, authApi, type Me, type Patient, type Shift, type TimeBlock } from '../api/client';

interface ShiftsProps {
  me: Me;
  patient: Patient;
  onBack: () => void;
  onSelectShift: (shift: Shift) => void;
  onLogout: () => void;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Shifts({ me, patient, onBack, onSelectShift, onLogout }: ShiftsProps) {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([authApi.shifts(), authApi.timeBlocks()])
      .then(([allShifts, blocks]) => {
        setShifts(allShifts);
        setTimeBlocks(blocks.filter((b) => !b.deleted));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load shifts');
      });
  }, [onLogout]);

  const patientShifts = (shifts ?? [])
    .filter((s) => s.patientId === patient.id)
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
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
                  return (
                    <button
                      type="button"
                      key={shift.id}
                      className="shift-card"
                      title={`${block?.name ?? 'Shift'} — view notes`}
                      onClick={() => onSelectShift(shift)}
                    >
                      <span className="shift-block">{block?.name ?? 'Shift'}</span>
                      <span className="shift-time">
                        {block ? `${block.startTime} – ${block.endTime}` : ''}
                      </span>
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
