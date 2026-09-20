/**
 * host-hat.ts — WHO IS PART OF THE HOST, as arithmetic on one array.
 *
 * ⚖ Owner 2026-09-20: *"on guestlist. we can also assign if they will be part
 * of the host."*
 *
 * ── WHY THIS IS NOT A COLUMN ───────────────────────────────────────────────
 * Because the repo already ruled on the shape. Migration
 * `20271172082670_host_and_celebrant_are_two_words.sql`, on the same subject:
 * *"HOW MANY HOSTS AN EVENT HAS IS ALREADY STORED — it is the count of its
 * `event_members` rows … A second copy of a fact the database already holds is
 * the shape this repo keeps paying for."* So no `guests.is_host`, and no new
 * table: a guest already carries `extra_roles`, `host` is already a
 * `GuestRole`, and `importanceGroupOf` already reads primary and extra roles
 * together. This is a flag flip on machinery that shipped in June.
 *
 * ── ⚠ THEY ARE STILL TWO DIFFERENT QUESTIONS, AND NEITHER ANSWERS THE OTHER ─
 * `event_members` says WHO CAN OPEN THE DASHBOARD. This says WHO IS NAMED AS
 * PART OF THE HOST ON THE GUEST LIST. A lola with no account hosts the
 * celebration and will never be a member; a planner with full access is not
 * part of the host family. Nothing reconciles them and nothing should start
 * deriving one from the other without the owner saying so — that would be the
 * second source of truth this note exists to avoid.
 *
 * ⛔ BEING PART OF THE HOST DOES NOT PIN ANYBODY TO THE TOP. The honoree does
 * that (lib/role-groups honoreeRank). At Lola's 80th the host is her daughter,
 * and pinning the host would put the wrong name first.
 *
 * ⛔ It does not move a seating tier either — the PRIMARY role drives seating
 * (iteration 0001's own words), and this only ever touches `extra_roles`.
 *
 * PURE — no I/O. The caller reads the rows and writes them back.
 */

import type { GuestRole } from './guests';

export const HOST_HAT: GuestRole = 'host';

export function wearsHostHat(
  role: GuestRole,
  extraRoles: readonly GuestRole[] | null | undefined,
): boolean {
  // The primary role counts too: a non-wedding guest list can set 'host' as
  // somebody's actual role, and a chip that ignored that would call a Host
  // "not hosting".
  return role === HOST_HAT || (extraRoles ?? []).includes(HOST_HAT);
}

/**
 * The array to write for one guest, or null when it is already correct.
 *
 * 🔑 NULL MEANS "NO WRITE NEEDED", which is what lets the caller collapse a
 * bulk of 200 guests into a couple of UPDATEs instead of 200 round trips.
 *
 * ⚠ The PRIMARY role is never touched. Turning the hat off for a guest whose
 * role IS 'host' would have to change what they are, not what they also are —
 * so it returns null and leaves them a Host. Demoting somebody's role is the
 * role picker's job and needs to be a deliberate act.
 */
export function nextExtraRoles(
  role: GuestRole,
  extraRoles: readonly GuestRole[] | null | undefined,
  on: boolean,
): GuestRole[] | null {
  const extra = extraRoles ?? [];
  const has = extra.includes(HOST_HAT);
  if (on) {
    if (has || role === HOST_HAT) return null;
    return [...extra, HOST_HAT];
  }
  if (!has) return null;
  return extra.filter((r) => r !== HOST_HAT);
}

/**
 * Group guests by the array they each need, so one UPDATE covers every guest
 * that lands on the same value.
 *
 * Returns [serializedKey, {extraRoles, guestIds}] — in practice a roster has a
 * handful of distinct `extra_roles` values, so a 200-guest bulk becomes two or
 * three statements.
 */
export function planHostHatWrites<
  G extends { guest_id: string; role: GuestRole; extra_roles: GuestRole[] | null },
>(
  guests: readonly G[],
  on: boolean,
): { extraRoles: GuestRole[]; guestIds: string[] }[] {
  const byValue = new Map<string, { extraRoles: GuestRole[]; guestIds: string[] }>();
  for (const g of guests) {
    const next = nextExtraRoles(g.role, g.extra_roles, on);
    if (next === null) continue;
    // Sorted only for the KEY, never for the value written — a stable key is
    // what makes two guests with the same roles in a different order share one
    // statement, while the value keeps the order the row already had.
    const key = [...next].sort().join(',');
    const bucket = byValue.get(key);
    if (bucket) bucket.guestIds.push(g.guest_id);
    else byValue.set(key, { extraRoles: next, guestIds: [g.guest_id] });
  }
  return [...byValue.values()];
}
