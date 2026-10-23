/**
 * lib/papic-widget.ts — HOME'S PAPIC WIDGET, its words (owner 2026-10-23: *"a smaller widget on home. Then we can
 * expand it"* · *"does not open to a new page. just expands on home"*).
 *
 * The collapsed card is the shipped Papic row plus ONE coverage line, in three days:
 *   · before the day → "Sat 12 Dec → Sun 13 Dec, 12 noon" (the cameras' first day → the instant they close);
 *   · on the day     → "Open now →";
 *   · after          → "Closed".
 * After the day the card's Add more becomes Thank-You Video.
 *
 * 🔑 THE DAY DECIDES, NOT THE WINDOW. The window opens months early (`PAPIC_CAPTURE_MONTHS_BEFORE`), so "open"
 * by the window is not "on the day"; the close instant is the gate's own (`captureWindowState`), never re-derived.
 */
import { captureWindowState, manilaDate } from '@/lib/papic-window';

export type PapicDay = 'before' | 'day' | 'after';

const MANILA = 'Asia/Manila';

/** Before · on the day · after — from the event day and the gate's close instant. */
export function papicDay(i: {
  eventDate: string | null;
  startDate: string | null;
  endIso: string | null;
  nowMs?: number;
}): PapicDay {
  const now = i.nowMs ?? Date.now();
  if (captureWindowState(i.startDate, i.endIso, now) === 'closed') return 'after';
  const day = manilaDate(i.eventDate);
  if (!day) return 'before';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: MANILA }).format(new Date(now));
  return day <= today ? 'day' : 'before';
}

/** "Sat 12 Dec" — the en-GB short parts, comma-free. */
function shortDay(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(
    new Date(ms),
  );
  const part = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

/** "12 noon" · "midnight" · "6 pm" · "6:30 pm". */
function clock(ms: number): string {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(ms))
    .split(':')
    .map(Number) as [number, number];
  if (m === 0 && h === 12) return '12 noon';
  if (m === 0 && h === 0) return 'midnight';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === 0 ? '' : `:${String(m).padStart(2, '0')}`} ${h < 12 ? 'am' : 'pm'}`;
}

/** The card's one coverage line, or null when the dates cannot be read (the card then says nothing, never a guess). */
export function papicCoverageLine(i: {
  day: PapicDay;
  startDate: string | null;
  endIso: string | null;
}): string | null {
  if (i.day === 'after') return 'Closed';
  if (i.day === 'day') return 'Open now →';
  const start = manilaDate(i.startDate);
  const end = i.endIso ? Date.parse(i.endIso) : NaN;
  if (!start || !Number.isFinite(end)) return null;
  const startMs = Date.parse(`${start}T12:00:00+08:00`);
  return `${shortDay(startMs)} → ${shortDay(end)}, ${clock(end)}`;
}
