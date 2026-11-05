/**
 * 🚗 ONE CREW, TWO EVENTS — event chapters slice 5 (owner 2026-11-04).
 *
 * A supplier's crew booked on two events the same day is flagged on the supplier's own schedule when:
 *   · its times OVERLAP — it cannot be in both places; or
 *   · the gap between them is SHORTER THAN THE DRIVE between the two venues.
 *
 * Owner's rulings, 2026-11-04:
 *   · "Same name, same shop" — a crew is the name the supplier types on a task ("Team A", "Second shooter"); the same
 *     name on two events of the same shop is the same crew. A task with no crew is the whole team and is not matched:
 *     a shop with three teams leaves it blank on every general task, and flagging those would flag every day.
 *   · "Admin-set speed" — the drive is the km between the two events' reception pins at ONE average speed, the
 *     owner's number (`platform_settings.drive_speed_kmh`). Unset = no drive is estimated and only overlaps are
 *     flagged. There is NO default here (CLAUDE.md rule 9, "don't guess").
 *
 * Only the supplier sees this: it names their other client, which the host of this event must never see.
 * Pure — the reads are `lib/crew-elsewhere.server.ts`.
 */
import { kmBetween } from '@/app/onboarding/wedding/_data/wedding-cities';
import { formatCount } from '@/lib/format-number';
import { clockWords } from '@/lib/schedule-chapters';

/** A moment with no end holds its crew this long — the supplier's own default moment length (`MOMENT_MINUTES_DEFAULT`). */
export const OPEN_STINT_MINUTES = 30;

/** One crew on one moment: where, when, and which event. */
export type CrewStint = {
  eventId: string;
  /** The moment on this event (a stint on another event keeps its own id, never shown). */
  blockId: string;
  crew: string;
  startIso: string;
  endIso: string | null;
  /** The event's reception pin; null = the event has none, so no drive is estimated to or from it. */
  pin: { lat: number; lon: number } | null;
  /** The event as the supplier knows it ("Ana & Ben"). */
  eventName: string;
};

export type CrewClash =
  | { kind: 'overlap'; crew: string; eventName: string; theirStartIso: string; words: string }
  | { kind: 'drive'; crew: string; eventName: string; theirStartIso: string; gapMinutes: number; driveMinutes: number; words: string };

const keyOf = (crew: string) => crew.trim().toLowerCase();

function span(s: CrewStint): { s: number; e: number } | null {
  const start = Date.parse(s.startIso);
  if (!Number.isFinite(start)) return null;
  const end = s.endIso ? Date.parse(s.endIso) : NaN;
  return { s: start, e: Number.isFinite(end) && end > start ? end : start + OPEN_STINT_MINUTES * 60_000 };
}

/** The drive between two pins at `speedKmh`, rounded UP to 5 minutes; null = a pin or the speed is missing. */
export function driveMinutes(a: CrewStint['pin'], b: CrewStint['pin'], speedKmh: number | null): number | null {
  if (!a || !b || !speedKmh || !(speedKmh > 0)) return null;
  const km = kmBetween(a, b);
  if (km <= 0) return 0;
  return Math.ceil(((km / speedKmh) * 60) / 5) * 5;
}

/** "45 min" · "1 h" · "2 h 5 min" — a drive or a gap, as a person says it. */
export function minutesWords(min: number): string {
  if (min < 60) return `${formatCount(min)} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${formatCount(h)} h` : `${formatCount(h)} h ${formatCount(m)} min`;
}

/**
 * Every stint HERE that clashes with the same crew on ANOTHER event → its clashes, keyed by the moment here.
 * `there` holds only the other events' stints (same shop, same day — the reader decides which events).
 */
export function crewElsewhere(here: readonly CrewStint[], there: readonly CrewStint[], speedKmh: number | null): Map<string, CrewClash[]> {
  const out = new Map<string, CrewClash[]>();
  for (const h of here) {
    const hs = span(h);
    if (!hs || !h.crew.trim()) continue;
    for (const t of there) {
      if (t.eventId === h.eventId || keyOf(t.crew) !== keyOf(h.crew)) continue;
      const ts = span(t);
      if (!ts) continue;
      const crew = h.crew.trim();
      let clash: CrewClash | null = null;
      if (hs.s < ts.e && ts.s < hs.e) {
        clash = { kind: 'overlap', crew, eventName: t.eventName, theirStartIso: t.startIso, words: `${crew} is also at ${t.eventName} at ${clockWords(t.startIso)}. The times overlap.` };
      } else {
        const drive = driveMinutes(h.pin, t.pin, speedKmh);
        const theyAreLater = ts.s >= hs.e;
        const gap = Math.round((theyAreLater ? ts.s - hs.e : hs.s - ts.e) / 60_000);
        if (drive !== null && drive > 0 && gap < drive) {
          const words = theyAreLater
            ? `${crew} is due at ${t.eventName} at ${clockWords(t.startIso)}, ${minutesWords(gap)} after this. The drive there is about ${minutesWords(drive)}.`
            : `${crew} is at ${t.eventName} until ${clockWords(new Date(ts.e).toISOString())}, ${minutesWords(gap)} before this. The drive from there is about ${minutesWords(drive)}.`;
          clash = { kind: 'drive', crew, eventName: t.eventName, theirStartIso: t.startIso, gapMinutes: gap, driveMinutes: drive, words };
        }
      }
      if (clash) out.set(h.blockId, [...(out.get(h.blockId) ?? []), clash]);
    }
  }
  return out;
}
