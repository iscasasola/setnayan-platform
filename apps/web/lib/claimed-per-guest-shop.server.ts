import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readInChunks } from '@/lib/read-all-pages';
import { followFromRows } from '@/lib/claimed-per-guest-follow';
import { agreedCountFromRow } from '@/lib/self-added-price-basis';
import { agreedTotalNow, CHANGE_LINES_EMBED, type ChangeLineRow } from '@/lib/agreed-total-and-its-changes';

/** A claimed per-guest booking as the supplier must read it — the same figure and count the couple sees. */
export type ShopPerGuest = {
  /** The booking's total now (`event_vendors.total_cost_php`, moved by `quote_follow_claimed_per_guest`), ₱. */
  totalPhp: number | null;
  /** The guests it bills now (the follow's count; the guests agreed when it never moved). */
  guests: number;
  /** The guests agreed — the minimum. */
  agreedGuests: number;
};

/**
 * 👥 RW-08 (re-walk 13 Nov 2026): a couple's own supplier priced PER GUEST, once the shop CLAIMS it, followed the guest
 * list on the couple's side (₱4,000 at 4 · ₱5,000 at 5) — but the supplier read "no quote yet" and "Est. pax 150":
 * nothing on its side looked at the booking's own figure. This is that one read, for THIS shop's own bookings only
 * (`marketplace_vendor_id` = the shop the session proved), per event.
 *
 * `null` = refused: the caller then draws as shipped, never a guessed count.
 */
export async function readShopPerGuest(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
  eventIds: readonly string[],
): Promise<Map<string, ShopPerGuest> | null> {
  const ids = [...new Set(eventIds)];
  const out = new Map<string, ShopPerGuest>();
  if (ids.length === 0) return out;
  const rowsRead = await readInChunks(ids, (part) =>
    admin
      .from('event_vendors')
      .select(`vendor_id, event_id, total_cost_php, pax_quote_base, ${CHANGE_LINES_EMBED}`)
      .eq('marketplace_vendor_id', vendorProfileId)
      .eq('pricing_basis', 'per_pax')
      .is('archived_at', null)
      .in('event_id', part),
  );
  if (rowsRead.error) {
    logQueryError('readShopPerGuest.rows', rowsRead.error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const rows = (rowsRead.rows ?? []) as Array<{
    vendor_id: string;
    event_id: string;
    total_cost_php: number | string | null;
    pax_quote_base: number | string | null;
    change_lines?: ChangeLineRow[] | null;
  }>;
  if (rows.length === 0) return out;
  const followRead = await readInChunks(
    rows.map((r) => r.vendor_id),
    (part) => admin.from('event_vendor_guest_follow').select('event_vendor_id, agreed_guests, billed_guests').in('event_vendor_id', part),
  );
  if (followRead.error) {
    logQueryError('readShopPerGuest.follow', followRead.error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const follows = new Map(
    ((followRead.rows ?? []) as Array<{ event_vendor_id: string; agreed_guests: number | null; billed_guests: number | null }>).map((f) => [f.event_vendor_id, f]),
  );
  for (const r of rows) {
    const follow = followFromRows(agreedCountFromRow('per_pax', r), follows.get(r.vendor_id));
    if (!follow) continue;
    // The agreed total NOW (owner 2026-09-11, "Show the total now") — the headline plus any change lines.
    const total = agreedTotalNow(r.total_cost_php, r.change_lines);
    out.set(r.event_id, {
      totalPhp: total != null && Number.isFinite(total) && total > 0 ? total : null,
      guests: follow.billedGuests,
      agreedGuests: follow.agreedGuests,
    });
  }
  return out;
}
