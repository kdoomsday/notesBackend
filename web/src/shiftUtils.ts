import type { Shift, TimeBlock } from './api/client';

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function isTimeInBlock(nowMinutes: number, start: string, end: string): boolean {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function shiftComparer(timeBlocks: TimeBlock[], dateDirection: 1 | -1) {
  return (a: Shift, b: Shift): number => {
    const byDate = dateDirection * a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate; // Dates are different, this wins
    const aStart = timeBlocks.find((tb) => tb.id === a.timeBlockId)?.startTime ?? '';
    const bStart = timeBlocks.find((tb) => tb.id === b.timeBlockId)?.startTime ?? '';
    return aStart.localeCompare(bStart);
  };
}

export function orderedPatientShifts(
  shifts: Shift[],
  timeBlocks: TimeBlock[],
  patientId: string
): Shift[] {
  return shifts.filter((s) => s.patientId === patientId).sort(shiftComparer(timeBlocks, 1));
}
