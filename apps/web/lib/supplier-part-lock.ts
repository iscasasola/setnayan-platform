/**
 * 🔒 CHANGE LOCK — does this host change touch a LOCKED supplier's part? (supplier gate audit D7, 2026-11-02;
 * DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (7), owner: *"change lock (means the supplier
 * cannot accept changes anymore)."*).
 *
 * Pure. The host schedule actions ask it BEFORE they write, so a refusal is said in words and nothing is attempted.
 * It is the early, polite half: the database refuses the same change on its own (the `*_part_lock` triggers,
 * migration 20271303409352), so a door that forgets to ask still cannot change a locked part.
 *
 * The same rule as the trigger: a change to when / where / what of a moment refuses if ANY locked shop is on it; a
 * change only to who is on it refuses only if a LOCKED shop is put on or taken off (another supplier's presence is
 * not the locked shop's part); `is_public`, the order and the guests' settings are nobody's part.
 */
import { PART_FIELDS, type PartMoment } from '@/lib/supplier-part-notice';
import { NOT_TAKING_CHANGES } from '@/lib/supplier-schedule-marks';

/** This event's supplier rows (`event_vendors.vendor_id`) whose shop is locked → the shop's name. */
export type PartLocks = ReadonlyMap<string, string>;

export type PartChangeShape =
  | { kind: 'fields' } // when / where / what moved on every moment given
  | { kind: 'delete' }
  | { kind: 'vendors'; after: readonly string[] }; // only who is on it

function firstLocked(ids: readonly string[] | null | undefined, locks: PartLocks): string | null {
  for (const id of ids ?? []) {
    const shop = locks.get(id);
    if (shop) return shop;
  }
  return null;
}

/** The locked shop this change would touch, or null when it touches none. */
export function lockedShopFor(moments: readonly PartMoment[], locks: PartLocks, change: PartChangeShape): string | null {
  if (locks.size === 0) return null;
  for (const m of moments) {
    if (change.kind === 'vendors') {
      const was = new Set(m.responsible_vendor_ids ?? []);
      const now = new Set(change.after);
      const moved = [...was].filter((v) => !now.has(v)).concat([...now].filter((v) => !was.has(v)));
      const shop = firstLocked(moved, locks);
      if (shop) return shop;
    } else {
      const shop = firstLocked(m.responsible_vendor_ids, locks);
      if (shop) return shop;
    }
  }
  return null;
}

const TIME_FIELDS = new Set(['start_at', 'end_at']);

function same(field: string, a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
  const x = norm(a);
  const y = norm(b);
  if (x === null || y === null) return x === y;
  if (TIME_FIELDS.has(field)) return Date.parse(String(x)) === Date.parse(String(y));
  return String(x) === String(y);
}

/**
 * Does a field save actually move the supplier's part? The inspector posts every field on every save, so "it was in
 * the form" is not "it changed" — a save that only shows a moment to guests must not meet the lock.
 */
export function patchTouchesPart(was: PartMoment, patch: Readonly<Record<string, unknown>>): boolean {
  return PART_FIELDS.some((f) => f in patch && !same(f, (was as Record<string, unknown>)[f], patch[f]));
}

/**
 * The host's screen, after a refused save: which locked supplier is on these moments? The server's own words do not
 * survive the trip to the browser (a thrown action error is redacted in production), so the rail reads the lock it
 * already draws (`times: NOT_TAKING_CHANGES` on the supplier line) and says the calm line itself. null = none locked here.
 */
export function lockedShopOnMoments(
  ids: readonly string[],
  moments: ReadonlyArray<{ block_id: string; parent_block_id?: string | null; responsible_vendor_ids: readonly string[] }>,
  suppliers: ReadonlyArray<{ vendor_id: string; vendor_name: string; times?: string }>,
): string | null {
  const locked = new Map(suppliers.filter((s) => s.times === NOT_TAKING_CHANGES).map((s) => [s.vendor_id, s.vendor_name]));
  if (locked.size === 0) return null;
  const want = new Set(ids);
  for (const m of moments) {
    // The moment itself, and the moments inside a chapter that moves with it.
    if (!want.has(m.block_id) && !(m.parent_block_id && want.has(m.parent_block_id))) continue;
    for (const v of m.responsible_vendor_ids) {
      const shop = locked.get(v);
      if (shop) return shop;
    }
  }
  return null;
}

/**
 * 📖 The chapters' MOMENT SHEET (`moment-sheets.tsx`, the Schedule page's current editor): the first LOCKED supplier on
 * this one moment, by shop name — or null. The sheet says it BEFORE a change ("<shop> isn’t taking changes. Send them a
 * request instead.", with the Ask on the same sheet), and again in place of "Try again." when a save is refused.
 * `locked` is the page's supplier read (`times === NOT_TAKING_CHANGES`), handed down on `who.suppliers`.
 */
export function lockedShopOnMoment(
  vendorIds: readonly string[],
  suppliers: ReadonlyArray<{ id: string; name: string; locked?: boolean }>,
): string | null {
  for (const id of vendorIds) {
    const s = suppliers.find((x) => x.id === id && x.locked === true);
    if (s) return s.name;
  }
  return null;
}
