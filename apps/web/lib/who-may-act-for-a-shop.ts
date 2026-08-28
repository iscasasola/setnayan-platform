/**
 * WHICH SHOPS MAY THIS ACCOUNT ACT FOR, ON THIS ONE CELEBRATION?
 *
 * ── THE OWNER'S TWO SENTENCES, AND NOTHING ELSE ─────────────────────────────
 * 2026-08-27: *"the staff who handles the event will handle the event fully but
 * the vendor owner also has access to oversight all their business."*
 * 2026-08-26: *"the ones they were given."*
 *
 * So there are exactly two ways in, and they are different shapes:
 *
 *   · RUNS THE SHOP — they own it, or they hold its top team role. Every
 *     celebration that shop is booked on, with no per-event paperwork. That is
 *     the "oversight all their business" half.
 *   · GRANTED FOR THIS CELEBRATION — a live `vendor_event_access_grants` row for
 *     THIS event. One celebration, the one they were handed. That is the "the
 *     ones they were given" half, and it is why this rule takes an event at all.
 *
 * A teammate at `agent` or `viewer` with no grant is refused — being on a shop's
 * roster is not being put on a wedding.
 *
 * ⚖ THE CONSEQUENCE IS NAMED, NOT DISCOVERED LATER. The answer here feeds
 * `resolveVendorCapability`, which feeds `belongsToThisEvent` — the single
 * boolean deciding whether somebody is "one of the people of this celebration",
 * which is the gate on a keepsake story the host restricted to exactly those
 * people. Widening who may act for a shop therefore widens who can read that
 * story. The owner was offered the careful version — staff who work the day
 * WITHOUT becoming one of its people — and declined it: working the event makes
 * you one of its people. So the widening ships, and it is said out loud on the
 * screen where the host picks that audience (`who-can-see-your-story.ts`).
 *
 * ── WHY IT IS PURE, AND IN ITS OWN FILE ─────────────────────────────────────
 * The read that resolves these facts is `lib/booked-supplier.ts`, which is
 * `server-only` and therefore cannot be imported by a unit test at all. The RULE
 * is the part worth pinning, so it lives here with no imports that touch a
 * network, exactly as `belongs-to-this-event.ts` and `host-scope.ts` already do.
 */

import { isVendorAdminRole, type VendorTeamRole } from '@/lib/vendor-team';

/** What one shop's relationship to this account, on this event, amounts to. */
export type ShopStanding = {
  vendorProfileId: string;
  /** They own the shop outright, or hold its top team role (`admin`/`owner`). */
  runsTheShop: boolean;
  /** A live, unrevoked per-event grant for THE event being asked about. */
  grantedForThisEvent: boolean;
};

/**
 * May this account act for this one shop, on this one celebration?
 *
 * Total and fail-closed: a standing that establishes neither fact is a no.
 */
export function mayActForShopHere(standing: ShopStanding): boolean {
  return standing.runsTheShop || standing.grantedForThisEvent;
}

/** Does this team role run the shop? `owner` is legacy data; both count. */
export function teamRoleRunsTheShop(role: string | null | undefined): boolean {
  if (typeof role !== 'string') return false;
  return isVendorAdminRole(role as VendorTeamRole);
}

/**
 * Fold the three facts a caller reads — owned shops, team rows, live grants for
 * THIS event — into the shop ids this account may act for here.
 *
 * ⚠ THE EVENT IS ALREADY APPLIED BEFORE THIS IS CALLED. `grantedProfileIds` must
 * already be filtered to the one event and to `revoked_at IS NULL`; this
 * function has no event id and cannot check it for you. Keeping the filter at
 * the query — where the index is — is why the signature looks like this, and it
 * is the one thing a caller can get wrong, so it is said here.
 */
export function shopsThisAccountMayActFor(input: {
  ownedProfileIds: readonly string[];
  teamRows: readonly { vendorProfileId: string; role: string | null }[];
  grantedProfileIds: readonly string[];
}): string[] {
  const standing = new Map<string, ShopStanding>();
  const touch = (vendorProfileId: string): ShopStanding => {
    const existing = standing.get(vendorProfileId);
    if (existing) return existing;
    const fresh: ShopStanding = {
      vendorProfileId,
      runsTheShop: false,
      grantedForThisEvent: false,
    };
    standing.set(vendorProfileId, fresh);
    return fresh;
  };

  for (const id of input.ownedProfileIds) touch(id).runsTheShop = true;
  for (const row of input.teamRows) {
    const s = touch(row.vendorProfileId);
    if (teamRoleRunsTheShop(row.role)) s.runsTheShop = true;
  }
  for (const id of input.grantedProfileIds) touch(id).grantedForThisEvent = true;

  return [...standing.values()].filter(mayActForShopHere).map((s) => s.vendorProfileId);
}
