import type { SeatLookupRow } from '@/lib/seat-lookup';

/**
 * lib/find-your-seat.ts — the decisions behind `/[slug]/find-seat`, pure so the
 * page, the lookup route and their tests ask ONE function each.
 *
 * Owner-approved 2026-09-27 ("ok to all"), spec corpus `DECISION_LOG.md` row
 * "FIND YOUR SEAT, REDESIGNED", prototype `prototypes/find_your_seat_2026-09-27.html`:
 *
 *   1 · the open search on the general link STAYS, but reveals ONLY a table and
 *       the room — never a name, not even the searcher's own;
 *   2 · on the open link, "not on the list" and "on the list but not seated"
 *       are ONE identical message. The honest "you're on the list" is for a
 *       key holder only (the account or the key proves who is asking);
 *   3 · tablemates show as first name + last initial, own table only;
 *   5 · the table, the room map and the on-screen door pass are FREE — no SKU
 *       gate anywhere on this page (the printed branded QR cards stay paid, on
 *       `/[slug]/seat`);
 *   · a quiet rate limit on the open lookup, ~10 tries a minute per device.
 */

// ═══ WHICH SCREEN ═══════════════════════════════════════════════════════════

/**
 * Who the page is speaking to — `resolveGuestViewer`'s answer
 * (`lib/guest-one-path.ts`), reduced to what this page needs.
 */
export type SeatViewerKind = 'cookie' | 'seat' | 'anonymous';

export type FindSeatMode =
  /** A1 / A2 — a key holder whose table is set. */
  | 'your_seat'
  /** A4 — a key holder the couple has not seated yet (or has not published). */
  | 'not_seated'
  /** B1–B3 — a stranger on a published plan: the exact-name search. */
  | 'search'
  /** B5 — a stranger, and the couple has not published the plan. */
  | 'not_posted';

/**
 * 🔑 A KEY HOLDER NEVER TYPES. The account or the key already says who is
 * asking, so the field is for the open link only — a signed-in guest (or one
 * who opened their QR / NFC / invitation link) lands straight on their seat.
 *
 * ⚖ An unpublished plan is `not_seated` for a key holder, never their table: a
 * DRAFT must not reveal a seat (the same publication gate the RPC and
 * `/[slug]/seat` keep).
 */
export function findSeatMode(input: {
  viewer: SeatViewerKind;
  published: boolean;
  tableId: string | null;
}): FindSeatMode {
  if (input.viewer !== 'anonymous') {
    return input.published && input.tableId ? 'your_seat' : 'not_seated';
  }
  return input.published ? 'search' : 'not_posted';
}

// ═══ WHAT A STRANGER'S SEARCH MAY CARRY ═════════════════════════════════════

/**
 * One open-search result. ⛔ THERE IS NO NAME FIELD, AND THAT IS THE POINT: the
 * RPC still returns `display_name` (it is the column the exact match runs on),
 * but nothing a stranger's browser receives carries it. A result is a table and,
 * when the couple recorded one, the walk to it.
 */
export type OpenSeatMatch = {
  table_label: string;
  walk_zone_label: string | null;
  walk_video_url: string | null;
};

/**
 * The RPC rows → what the open route may send. Built field by field (never a
 * spread), so a column the RPC grows later cannot ride along into the response.
 * Duplicate tables collapse — a same-name pair at one table is one answer.
 */
export function openSeatMatches(
  rows: readonly SeatLookupRow[],
  presigned: ReadonlyMap<string, string | null>,
): OpenSeatMatch[] {
  const out: OpenSeatMatch[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const label = (r.table_label ?? '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const key = r.walk_video_key ?? null;
    out.push({
      table_label: label,
      walk_zone_label: key ? (r.walk_zone_label ?? null) : null,
      walk_video_url: key ? (presigned.get(key) ?? null) : null,
    });
  }
  return out;
}

/**
 * THE ONE MESSAGE for "not on the list" AND "on the list, not seated yet".
 * The RPC answers both with zero rows (it JOINs the seat assignment), so the
 * route cannot tell them apart — and this copy must not try. It names only the
 * two fixes that are true in both cases.
 */
export function noTableForThatName(names: string): { title: string; lines: [string, string, string] } {
  return {
    title: 'No table for that name yet',
    lines: [
      `Try it exactly as ${names} would have written it — first and last name, no nicknames.`,
      `If you’re on the list, ${names} may still be arranging the room. Your invitation link always shows your seat once it’s set.`,
      'At the venue, a host at the door can look you up.',
    ],
  };
}

// ═══ THE QUIET RATE LIMIT ═══════════════════════════════════════════════════

/** ~10 tries a minute per device (owner-approved, decision row "FIND YOUR SEAT"). */
export const SEAT_LOOKUP_DEVICE_LIMIT = 10;
export const SEAT_LOOKUP_DEVICE_WINDOW_SECS = 60;
/** Limiter bucket — `enforceRateLimit` (lib/with-rate-limit.ts), the repo's one limiter. */
export const SEAT_LOOKUP_DEVICE_BUCKET = 'seat_lookup_device';

/** The header the search sends its device id in, and where the browser keeps it. */
export const SEAT_DEVICE_HEADER = 'x-seat-device';
export const SEAT_DEVICE_STORAGE_KEY = 'setnayan_seat_device';

/** A device id the browser minted: 16–64 lowercase hex. Anything else is ignored. */
export function isSeatDeviceId(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^[0-9a-f]{16,64}$/.test(v);
}

/** FNV-1a, 32-bit — a fingerprint, not a secret; keeps the key short and the UA out of storage. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The limiter key for ONE device on ONE event.
 *
 * ⚖ WHY A DEVICE, NOT AN IP. A reception is one NAT'd wifi address shared by
 * every phone in the room (the reasoning `lib/join-door-throttle.ts` records),
 * and an arrival rush is exactly when this page is used — an IP-keyed ten a
 * minute would turn real guests away at the door. So the key is the id the
 * browser keeps; a request without one (a script that drops it, a browser with
 * storage off) falls back to connection + browser, which is the per-device
 * answer the network can still give.
 *
 * ⚠ HONEST LIMIT: a caller can mint ids. That is why the route KEEPS its older
 * per-connection limit beside this one, and why neither is the real guard —
 * the RPC answers only an exact full name, one seat.
 */
export function seatLookupDeviceKey(input: {
  slug: string;
  deviceId: string | null | undefined;
  ip: string | null | undefined;
  userAgent: string | null | undefined;
}): string {
  const slug = input.slug.trim().toLowerCase();
  if (isSeatDeviceId(input.deviceId)) return `${slug}:d:${input.deviceId}`;
  return `${slug}:n:${input.ip?.trim() || 'unknown'}:${fnv1a(input.userAgent ?? '')}`;
}

// ═══ WHO IS AT YOUR TABLE ═══════════════════════════════════════════════════

/**
 * "Ben R." — first name + last initial, the shipped table-sign form (moved here
 * from `/[slug]/seat`, where the public table view uses it). Own table only:
 * the page reads the viewer's OWN assignment's table and nothing else.
 */
export function publicDisplayName(first: string | null, last: string | null): string {
  const f = first?.trim() ?? '';
  const lastInitial = last?.trim()?.charAt(0)?.toUpperCase();
  if (f && lastInitial) return `${f} ${lastInitial}.`;
  return f || (lastInitial ? `${lastInitial}.` : '');
}

/** Seats at the table nobody holds yet — never negative, never on a table with no capacity. */
export function seatsStillOpen(capacity: number | null | undefined, seated: number): number {
  const cap = Number(capacity);
  if (!Number.isFinite(cap) || cap <= 0) return 0;
  return Math.max(0, Math.floor(cap) - seated);
}

// ═══ THE DOOR'S CLOCK ═══════════════════════════════════════════════════════

/**
 * "5:42 pm" — when the door scanned this guest in, on the VENUE'S clock.
 *
 * ⚖ `guest_checkins.checked_in_at` is a REAL instant (the moment of the scan),
 * not a schedule wall clock parked in UTC, so it IS shifted into the venue's
 * zone — the opposite of a schedule time (see
 * `a-schedule-time-reads-the-same-everywhere.test.ts`).
 */
export function checkedInClock(iso: string | null | undefined, venueTz: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: venueTz }).toLowerCase();
}

// ═══ THE POSTMARK ═══════════════════════════════════════════════════════════

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as const;

/** "18 · XII · 2026" for the Vintage postmark — read as a calendar date, never shifted by a zone. */
export function postmarkDate(isoDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!m) return null;
  const month = ROMAN_MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} · ${month} · ${m[1]}`;
}
