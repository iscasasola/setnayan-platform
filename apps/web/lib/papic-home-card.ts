/**
 * papic-home-card.ts — THE HOME PAPIC CARD'S ONE COVERAGE LINE (owner 2026-10-23, approved
 `prototypes/papic_controller_one_page_2026-10-23.html` — "Home — the Papic widget": *"a smaller widget on home.
 * Then we can expand it"*). Before the day: "Fri, Dec 11 → Sun, Dec 13, 12 noon"; on it: "Open now → Sun, Dec 13,
 * 12 noon"; after: "Closed Sun, Dec 13, 12 noon"; Papic switched off: "Papic is off". The venue's clock (Manila).
 * Pure — `papic-home-card.test.ts`.
 */

export type PapicCardPhase = 'before' | 'live' | 'after';

const TZ = 'Asia/Manila';

function day(d: Date): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

function close(endMs: number): string {
  const d = new Date(endMs);
  const parts = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const ap = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toLowerCase();
  const time = h === '12' && m === '00' && ap.startsWith('p') ? '12 noon' : `${h}${m === '00' ? '' : `:${m}`} ${ap}`.trim();
  return `${day(d)}, ${time}`;
}

export function papicCardPhase(startIso: string | null, endIso: string | null, now: number): PapicCardPhase | null {
  const s = startIso ? Date.parse(startIso) : NaN;
  const e = endIso ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return now >= e ? 'after' : now >= s ? 'live' : 'before';
}

/** The line, or null when the window cannot be read (the card then draws no coverage line — never a guess). */
export function papicCoverageWords({
  startIso,
  endIso,
  now,
  on = true,
}: {
  startIso: string | null;
  endIso: string | null;
  now: number;
  on?: boolean;
}): string | null {
  if (!on) return 'Papic is off';
  const phase = papicCardPhase(startIso, endIso, now);
  if (!phase) return null;
  const e = Date.parse(endIso!);
  if (phase === 'after') return `Closed ${close(e)}`;
  if (phase === 'live') return `Open now → ${close(e)}`;
  return `${day(new Date(Date.parse(startIso!)))} → ${close(e)}`;
}

/** The window as the controller says it — "Sat, Dec 12 → Sun, Dec 13, 12 noon" (the venue's clock); null if unread. */
export function papicSpanWords(startIso: string | null, endIso: string | null): string | null {
  const s = startIso ? Date.parse(startIso) : NaN;
  const e = endIso ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return `${day(new Date(s))} → ${close(e)}`;
}

/** One day as the controller says it — "Sat, Dec 12" (the venue's clock); null if unread. */
export function papicDayWords(iso: string | null): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? day(new Date(t)) : null;
}
