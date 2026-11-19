/**
 * shop-status.ts — IS THIS SHOP OPEN, PAUSED OR CLOSED. One reading, for Shop ⚙ › Shop status and the admin desk.
 *
 * ── THE RULINGS (specs DECISION_LOG) ─────────────────────────────────────────
 *   · 2026-10-31 "SHOP STATUS RULED" — owner: *"They can pause and close. Admin can also do that"*.
 *   · 2026-11-16 "AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW" — no new asks or bookings, no new client
 *     imports, the website and QR read "This shop is paused"; existing bookings and their chats continue.
 *
 * ── WHERE IT IS STORED (migration 20271350091032) ───────────────────────────
 *   · PAUSED = `vendor_profiles.paused_at` set (with `paused_by` 'supplier' | 'admin'). Read by `is_findable`
 *     (lists), `enforce_booking_requires_verified_vendor` (asks + bookings) and their app twins
 *     (`isShopFindable`, `shopBookingRefusal`).
 *   · CLOSED = `public_visibility = 'archived'` — the closed state every gate already reads. No second column.
 *   · Both are written ONLY by `set_shop_status()` (a database door that checks who is asking), never by an
 *     `.update()`: a session's direct write to the pause columns is refused by `guard_vendor_shop_pause`.
 *
 * ⚠ The Shop status row on the supplier side and the paused line on the shop page wait on an owner-approved
 * drawing. The Shortlist QR page already says {@link SHOP_PAUSED_LINE} (owner answer 4, 16 Nov).
 */
import { parseVisibility } from './vendor-visibility';

export type ShopStatus = 'open' | 'paused' | 'closed';

export type ShopPausedBy = 'supplier' | 'admin';

/** The columns {@link shopStatusOf} reads, for a `.select()` (session readers: `authenticated` holds the grant). */
export const SHOP_STATUS_COLUMNS = 'public_visibility, paused_at, paused_by' as const;

export type ShopStatusRow = {
  public_visibility?: unknown;
  paused_at?: unknown;
  paused_by?: unknown;
};

const present = (v: unknown) => v !== null && v !== undefined && v !== '';

/**
 * The shop's status. `null` when the row was not read, or a pause column was not selected — never guessed as
 * "open" (a short select must not show a paused shop a Pause button that does nothing).
 */
export function shopStatusOf(row: ShopStatusRow | null | undefined): ShopStatus | null {
  if (!row) return null;
  if (parseVisibility(row.public_visibility) === 'archived') return 'closed';
  if (!('paused_at' in row)) return null;
  return present(row.paused_at) ? 'paused' : 'open';
}

/** Who paused it, when paused. Only Setnayan lifts a pause Setnayan set. */
export function shopPausedBy(row: ShopStatusRow | null | undefined): ShopPausedBy | null {
  if (!row || !present(row.paused_at)) return null;
  return row.paused_by === 'admin' ? 'admin' : row.paused_by === 'supplier' ? 'supplier' : null;
}

/** True while the shop takes nothing new — the app twin of `paused_at IS NOT NULL`. */
export function isShopPaused(row: ShopStatusRow | null | undefined): boolean {
  return !!row && present(row.paused_at);
}

/**
 * ⏸ The words a couple reads where a paused shop would take something new — owner 2026-11-16, verbatim ("its website
 * and QR show "This shop is paused""). One constant, so the QR page and (when drawn) the shop page say the same thing.
 */
export const SHOP_PAUSED_LINE = 'This shop is paused';

/** The line under it: true for every paused shop, and it promises nothing about when it reopens. */
export const SHOP_PAUSED_DETAIL = 'It isn’t taking new bookings right now.';

/** Why `set_shop_status()` said no. `unreadable` = the call failed for any other reason. */
export type ShopStatusRefusal =
  | 'not_allowed'
  | 'owner_only'
  | 'open_bookings'
  | 'paused_by_setnayan'
  | 'closed'
  | 'missing'
  | 'bad_status'
  | 'unreadable';

const KNOWN: ReadonlySet<string> = new Set([
  'not_allowed',
  'owner_only',
  'open_bookings',
  'paused_by_setnayan',
  'closed',
  'missing',
  'bad_status',
]);

/**
 * Reads the door's `shop_status:<reason>[:<count>]` refusal back. `openBookings` is how many bookings are still
 * open when a close was refused for them (the approved drawing's "Finish or cancel your 2 bookings first").
 */
export function parseShopStatusRefusal(message: string | null | undefined): {
  reason: ShopStatusRefusal;
  openBookings?: number;
} {
  const m = /shop_status:([a-z_]+)(?::(\d+))?/.exec(String(message ?? ''));
  if (!m || !KNOWN.has(m[1]!)) return { reason: 'unreadable' };
  const reason = m[1] as ShopStatusRefusal;
  if (reason === 'open_bookings' && m[2]) return { reason, openBookings: Number(m[2]) };
  return { reason };
}

/** The admin desk's sentence for a refused Pause / Unpause (the supplier's words wait on the drawing). */
export function shopStatusRefusalForAdmin(reason: ShopStatusRefusal): string {
  switch (reason) {
    case 'closed':
      return 'This shop is closed (archived). Restore its listing first.';
    case 'missing':
      return 'Supplier not found.';
    case 'unreadable':
      return 'The shop could not be read, so nothing was changed. Try again.';
    case 'open_bookings':
      return 'This shop still has open bookings. It can be closed once they are finished or cancelled.';
    case 'not_allowed':
      return 'Only a Setnayan admin can pause or unpause another shop.';
    default:
      return 'The shop status could not be changed. Try again.';
  }
}

/** The statuses the door accepts. */
export function parseShopStatus(raw: unknown): ShopStatus | null {
  return raw === 'open' || raw === 'paused' || raw === 'closed' ? raw : null;
}
