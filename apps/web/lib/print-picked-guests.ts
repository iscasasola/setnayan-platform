/**
 * 🎟 PICK GUESTS — SOME GUESTS' PASSES OR QR CODES IN ONE FILE (owner 2026-10-25, on the guest pass / QR print: *"instead of just
 * making me select all, allow me to pick multiple guests to compile together as well."*).
 *
 * Beside "All guests" (still the default), "Pick guests" opens a sheet that ticks guests and prints ONLY those, ganged on A4 with the
 * same cut lines (#6876). The address carries the picked ids as one `guests=<id>,<id>,…` parameter — the route's own way of naming a
 * guest (`pass_guest=<id>`), read after the same host gate.
 *
 * 🔒 THE SERVER DECIDES, NEVER THE ADDRESS: every picked id must be one of the guests that file would print for THIS event
 * (`pickGuestRows` over `passGuestRows`, the same read and rule as All guests). One unknown id refuses the whole file — it is never
 * silently dropped, and never silently included. No list at all prints everyone, exactly as before.
 *
 * Pure (no server import): the route, the loader and the sheet share it, and the tests execute it.
 */

import { formatCount } from '@/lib/format-number';

/** The address parameter that carries the picked guests. */
export const PICKED_GUESTS_PARAM = 'guests';

/** The most guests one picked file may name — past this, All guests is the file (and the address stays well under a URL's limit). */
export const MAX_PICKED_GUESTS = 250;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Said when a picked guest is not one this file prints for this event. */
export const PICKED_GUEST_REFUSAL = 'One of the guests you picked is not on this event’s list for this print. Reopen Prints and pick again.';

export type PickedGuests = { ok: true; ids: ReadonlySet<string> | null } | { ok: false; why: string };

/**
 * The `guests=` parameter, read. Absent → `ids: null` (every guest, unchanged). Present but empty, malformed or over
 * `MAX_PICKED_GUESTS` → refused, never read as "everyone".
 */
export function parsePickedGuests(raw: string | null): PickedGuests {
  if (raw === null) return { ok: true, ids: null };
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, why: 'Pick at least one guest.' };
  if (parts.length > MAX_PICKED_GUESTS) return { ok: false, why: `Pick up to ${formatCount(MAX_PICKED_GUESTS)} guests at a time — or print All guests.` };
  if (parts.some((p) => !UUID.test(p))) return { ok: false, why: PICKED_GUEST_REFUSAL };
  return { ok: true, ids: new Set(parts.map((p) => p.toLowerCase())) };
}

/**
 * The rows a file prints: every row (no pick), or exactly the picked ones in the file's own order. Any picked id that is not among
 * `all` (another event's guest, a removed guest, one with no pass) refuses the file — `unknown` names them.
 */
export function pickGuestRows<T extends { guest_id: string }>(
  all: readonly T[],
  picked: ReadonlySet<string> | null,
): { ok: true; rows: T[] } | { ok: false; unknown: string[] } {
  if (!picked) return { ok: true, rows: [...all] };
  const have = new Set(all.map((g) => g.guest_id.toLowerCase()));
  const unknown = [...picked].filter((id) => !have.has(id));
  if (unknown.length) return { ok: false, unknown };
  return { ok: true, rows: all.filter((g) => picked.has(g.guest_id.toLowerCase())) };
}

/** The all-guests file's address, narrowed to the picked guests. */
export function pickedGuestsHref(href: string, ids: readonly string[]): string {
  return `${href}${href.includes('?') ? '&' : '?'}${PICKED_GUESTS_PARAM}=${ids.map(encodeURIComponent).join(',')}`;
}

/** The sheet's filters: a typed name, a side, a group — each optional; `''` is "Any". */
export type PickGuestFilter = { query: string; side: string; group: string };

/** The guests the sheet shows for its filters (case- and accent-blind, any part of the name). */
export function filterPickGuests<G extends { name: string; side?: string | null; group?: string | null }>(guests: readonly G[], f: PickGuestFilter): G[] {
  const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(f.query.trim());
  return guests.filter((g) => (!q || fold(g.name).includes(q)) && (!f.side || g.side === f.side) && (!f.group || g.group === f.group));
}

/** The values a filter dropdown offers — each distinct side or group among the guests, in first-seen order. */
export function pickFilterValues<G>(guests: readonly G[], of: (g: G) => string | null | undefined): string[] {
  const out: string[] = [];
  for (const g of guests) {
    const v = of(g);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
