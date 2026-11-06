/**
 * papic-home-card.ts — THE PAPIC CARD'S WORDS FOR ITS WINDOW (the venue's clock, Manila): where the window stands
 * (`papicCardPhase` — after the day, the open card leads with the Thank-You Video door), and the dates as the open
 * settings say them ("Sat, Dec 12 → Sun, Dec 13, 12 noon"). The closed card's coverage line was retired 2026-10-26
 * (owner: "it just needs to have a quick on off button and expand for more settings"). Pure — `papic-home-card.test.ts`.
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
