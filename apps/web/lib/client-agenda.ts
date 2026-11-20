/**
 * 📅 ONE DATED LIST FROM TODAY TO THE DAY (Unichat part F, owner 2026-11-20; drawing `unichat_live_v3_2026-11-20.html`
 * `riseBody('next')` — specs e10c544b). The strip's Next box raises it over the chat: a Done fold, then the weeks ahead
 * ("This week · Nov 20 – 22", "Next week · Nov 23 – 29", "Nov 30 – Dec 6", …), then the event day itself.
 *
 * NOTHING HERE IS A NEW RECORD. Each row is a date the client page already read:
 *   · a MEETING day and a PAYMENT due day — the shipped `clientScheduleDays` rows (lib/schedule-days.ts);
 *   · the live QUOTE's good-until — the sent proposal's `valid_until`, until the booking locks it.
 * The event day is not a row: it is the list's last section (the venue's window, your part of the day).
 *
 * Pure and zone-free: every day is a civil `YYYY-MM-DD` (today is Manila's, `manilaTodayIso`). 🔒 lib/client-agenda.test.ts
 */
import { addDays, type ScheduleDayItem } from './schedule-days';

export type AgendaStatus = 'Set' | 'Asked' | 'Due' | 'Logged' | 'Done';
/** The row's colour family — the chat's kind ramps (`kind-meeting`, `kind-payment`, `kind-quote`). */
export type AgendaKind = 'meeting' | 'payment' | 'quote';

export type AgendaRow = {
  key: string;
  day: string;
  /** "Nov" · "20" — the drawing's date tile. */
  mon: string;
  d: string;
  title: string;
  status: AgendaStatus;
  kind: AgendaKind;
};

export type AgendaGroup = { key: string; heading: string; rows: AgendaRow[] };

export type Agenda = {
  /** "28 days to the event" — null when the date is unset or past. */
  daysToEvent: number | null;
  done: AgendaRow[];
  groups: AgendaGroup[];
  /** Nothing dated between today and the day (the drawing's "Nothing dated before the day."). */
  nothingAhead: boolean;
};

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parts(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}
function monDay(day: string): { mon: string; d: string } {
  const p = parts(day);
  return { mon: MONTH[p.m - 1]!, d: String(p.d) };
}
/** Days from `a` to `b` (civil). */
export function daysBetween(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}
/** Monday of the week holding `day` (the drawing's weeks run Monday → Sunday). */
function mondayOf(day: string): string {
  const p = parts(day);
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}
/** "Nov 20 – 22" · "Nov 30 – Dec 6" · "Dec 18". */
export function rangeWords(from: string, to: string): string {
  const a = monDay(from);
  const b = monDay(to);
  if (from === to) return `${a.mon} ${a.d}`;
  return a.mon === b.mon ? `${a.mon} ${a.d} – ${b.d}` : `${a.mon} ${a.d} – ${b.mon} ${b.d}`;
}

/** A meeting's chip / a payment's chip (the shipped words) → the drawing's status. */
function statusOf(item: ScheduleDayItem): AgendaStatus {
  if (item.kind === 'meeting') return item.chip === 'Both said yes' ? 'Set' : item.chip === 'Done' ? 'Done' : 'Asked';
  return item.chip === 'Paid' ? 'Done' : item.chip === 'Waiting for you to confirm' ? 'Logged' : 'Due';
}

export function clientAgenda(input: {
  todayIso: string;
  eventDate: string | null;
  /** `clientScheduleDays` — its meeting and payment rows (event rows are the last section, not a row). */
  days: readonly ScheduleDayItem[];
  /** The live quote while it is not booked: its version and good-until day. null = none (or booked). */
  quote: { version: number | null; validUntil: string | null } | null;
}): Agenda {
  const today = input.todayIso;
  const eventDay = input.eventDate && DAY.test(input.eventDate.slice(0, 10)) ? input.eventDate.slice(0, 10) : null;
  const rows: AgendaRow[] = [];
  for (const it of input.days) {
    if (it.kind === 'event' || !DAY.test(it.day)) continue;
    rows.push({ key: it.key, day: it.day, ...monDay(it.day), title: it.title, status: statusOf(it), kind: it.kind });
  }
  const until = input.quote?.validUntil?.slice(0, 10) ?? '';
  if (input.quote && DAY.test(until)) {
    const v = input.quote.version ? `Quote v${input.quote.version}` : 'Quote';
    rows.push({ key: `quote:${until}`, day: until, ...monDay(until), title: `${v} good until`, status: until < today ? 'Done' : 'Due', kind: 'quote' });
  }
  rows.sort((a, b) => a.day.localeCompare(b.day) || a.key.localeCompare(b.key));

  const done = rows.filter((r) => r.status === 'Done' || r.day < today);
  const ahead = rows.filter((r) => !done.includes(r));

  const groups: AgendaGroup[] = [];
  const thisMonday = mondayOf(today);
  for (const r of ahead) {
    let key: string;
    let heading: string;
    if (eventDay && r.day >= eventDay) {
      key = 'after';
      // One closing group: "On the day" while it holds only the day itself, "After the event" once anything is later.
      heading = r.day === eventDay ? 'On the day' : 'After the event';
    } else {
      const monday = mondayOf(r.day);
      const weeks = daysBetween(thisMonday, monday) / 7;
      const from = monday < today ? today : monday;
      let to = addDays(monday, 6);
      if (eventDay && to >= eventDay) to = addDays(eventDay, -1);
      key = `w:${monday}`;
      heading = `${weeks === 0 ? 'This week · ' : weeks === 1 ? 'Next week · ' : ''}${rangeWords(from, to)}`;
    }
    const g = groups.find((x) => x.key === key);
    if (g) {
      g.rows.push(r);
      if (key === 'after' && r.day !== eventDay) g.heading = 'After the event';
    } else groups.push({ key, heading, rows: [r] });
  }

  const daysToEvent = eventDay && eventDay >= today ? daysBetween(today, eventDay) : null;
  return { daysToEvent, done, groups, nothingAhead: groups.length === 0 };
}

/** "18 Dec" — the event day's head (the drawing's `Event day · 18 Dec · Fernwood Gardens`). */
export function dayMonthWords(day: string | null): string | null {
  if (!day || !DAY.test(day.slice(0, 10))) return null;
  const p = monDay(day.slice(0, 10));
  return `${p.d} ${p.mon}`;
}

/** The head's line: "28 days to the event" · "The event is today" · "After the event". */
export function agendaLine(a: Agenda, eventDate: string | null): string {
  if (a.daysToEvent === null) return eventDate ? 'After the event' : 'No event date yet';
  if (a.daysToEvent === 0) return 'The event is today';
  return `${a.daysToEvent} ${a.daysToEvent === 1 ? 'day' : 'days'} to the event`;
}
