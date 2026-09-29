/**
 * messages-team-picker.ts — who a couple can start a conversation with from
 * their Messages page: the suppliers already on Your Team.
 *
 * ─── WHY (2026-09-30, a dead end found by a read-only audit) ──────────────
 * Messages' "Start a new thread" asked for the supplier's email
 * (`startThreadByVendorEmail`). No shop shows its email any more (owner
 * 2026-09-10: *"not to let them communicate outside the app"*), so the box
 * asked for something the couple has no way to know. The couple DOES know who
 * is on their team — so the page offers exactly those, in one PickMenu, and
 * picking one opens that supplier's conversation through the shipped
 * `contactShortlistVendor` → `startServiceInquiry` path (the same one the
 * bench's Inquire and the budget card's Message use). No second way to open a
 * thread.
 *
 * ─── THE RULES THIS FILE HOLDS (pure; tested directly) ────────────────────
 *   · ONLY a supplier on Setnayan can be messaged. A row the couple typed in
 *     by hand (`marketplace_vendor_id` null) has no shop to message, and
 *     offering it would end at "This vendor can't be messaged here".
 *   · ONE ENTRY PER SHOP. A shop on the team for two services is two
 *     `event_vendors` rows but one conversation (chat_threads is UNIQUE on
 *     event + shop), so it is listed once.
 *   · THE NAME IS THE ANONYMITY-SAFE NAME. `event_vendors.vendor_name` is a
 *     copy of the shop's real business name; the bench and the thread list
 *     both show `resolveVendorDisplayName` instead, and so does this list —
 *     or it would reveal a name the rest of the app still hides. A profile we
 *     could not read shows no name at all ("A supplier on your team").
 */
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';

/** The `event_vendors` columns this needs (a subset of `EventVendorRow`). */
export type TeamRow = {
  vendor_id: string;
  marketplace_vendor_id: string | null;
};

/** The `vendor_profiles` columns the anonymity resolver needs. */
export type TeamProfile = {
  vendor_profile_id: string;
  business_name: string | null;
  screen_name: string | null;
  name_revealed_at: string | null;
  services: string[] | null;
  location_city: string | null;
  tier_state: string | null;
  verification_state: string | null;
};

export type TeamPick = {
  /** `event_vendors.vendor_id` — what `contactShortlistVendor` takes. */
  vendorId: string;
  /** The name the couple reads (anonymity-safe). */
  name: string;
};

export function teamPicksForMessages(
  rows: readonly TeamRow[],
  profiles: readonly TeamProfile[],
): TeamPick[] {
  const byProfile = new Map(profiles.map((p) => [p.vendor_profile_id, p]));
  const seen = new Set<string>();
  const picks: TeamPick[] = [];
  for (const r of rows) {
    const shop = r.marketplace_vendor_id;
    if (!shop || seen.has(shop)) continue;
    seen.add(shop);
    const p = byProfile.get(shop);
    const input = {
      business_name: p?.business_name ?? null,
      name_revealed_at: p?.name_revealed_at ?? null,
      isPaidTier: isTrueNameTier(p?.tier_state ?? null),
      is_verified: p?.verification_state === 'verified',
      services: p?.services ?? null,
      screen_name: p?.screen_name ?? null,
      primary_canonical_service: p?.services?.[0] ?? null,
      location_city: p?.location_city ?? null,
    };
    // An unread profile, or the resolver's bare 'Vendor' fallback, reads as a
    // plain phrase — the UI says "supplier", never "vendor".
    const resolved = p ? resolveVendorDisplayName(input) : '';
    const name = resolved && resolved !== 'Vendor' ? resolved : 'A supplier on your team';
    picks.push({ vendorId: r.vendor_id, name });
  }
  return picks.sort((a, b) => a.name.localeCompare(b.name));
}
