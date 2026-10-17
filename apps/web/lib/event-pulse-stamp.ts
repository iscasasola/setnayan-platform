import { createHash } from 'node:crypto';
import type { PulseAnswer } from './event-pulse';

/**
 * event-pulse-stamp.ts — THE ARITHMETIC OF "HAS ANYTHING CHANGED?" (2026-10-18, live-day polling), apart from its reads
 * so a test can hold it (the reads live in `event-pulse.server.ts`, which is server-only).
 *
 * `v` folds every event-wide fact the guests' day-of pages draw; `g` lists, per guest (one-way key), the latest moment
 * one of THEIR things changed. See `event-pulse.server.ts` for what is watched and what is not, and why.
 */

/** The event row's columns that move without anything a guest sees moving. Left out of the stamp. */
export const PULSE_NOISE_COLUMNS: ReadonlySet<string> = new Set(['updated_at', 'last_kwento_notify_at', 'full_res_drop_warned_at']);

/** A guest's key in `g`: one-way, per event. The page hands it to the phone; the phone never sees a guest id. */
export function guestPulseKey(eventId: string, guestId: string): string {
  return createHash('sha256').update(`pulse:${eventId}:${guestId}`).digest('hex').slice(0, 12);
}

type Rows = Record<string, unknown>[] | 'absent' | null;

function sorted(rows: Rows, ...keys: string[]): unknown {
  if (rows === 'absent' || rows === null) return rows;
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const x = String(a[k] ?? '');
      const y = String(b[k] ?? '');
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  });
}

export function pulseFromRows(input: {
  event: Record<string, unknown>;
  /** The day-of phase and lifecycle stage the event's clock gives now — crossing a boundary moves the stamp. */
  clock: unknown;
  blocks: Rows;
  seats: Rows;
  tables: Rows;
  /** Whether guests may see their seats now (`guestsMaySeeSeatsFor`). */
  floor: unknown;
  hero: unknown;
  arrivals: { guest_id: string; checked_in_at: string | null }[] | 'absent' | null;
  tags: { guest_id: string; created_at: string | null; removed_at: string | null }[] | 'absent' | null;
}): PulseAnswer {
  const eventFacts: Record<string, unknown> = {};
  for (const k of Object.keys(input.event).sort()) if (!PULSE_NOISE_COLUMNS.has(k)) eventFacts[k] = input.event[k];
  const v = createHash('sha256')
    .update(
      JSON.stringify([
        eventFacts,
        input.clock,
        sorted(input.blocks, 'block_id'),
        sorted(input.seats, 'guest_id', 'table_id'),
        sorted(input.tables, 'table_id'),
        input.floor,
        input.hero,
      ]),
    )
    .digest('base64url')
    .slice(0, 16);

  const eventId = String(input.event.event_id);
  const g: Record<string, string> = {};
  const touch = (guestId: unknown, at: unknown) => {
    if (typeof guestId !== 'string' || typeof at !== 'string') return;
    const key = guestPulseKey(eventId, guestId);
    if (!g[key] || g[key]! < at) g[key] = at;
  };
  if (input.arrivals !== 'absent') for (const a of input.arrivals ?? []) touch(a.guest_id, a.checked_in_at);
  if (input.tags !== 'absent') {
    for (const t of input.tags ?? []) {
      touch(t.guest_id, t.created_at);
      touch(t.guest_id, t.removed_at);
    }
  }
  return { v, g };
}
