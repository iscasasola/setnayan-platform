import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { hydrateVendorCards, type VendorCard } from '@/lib/vendor-cards';

/** Committed vendor_status values — the vendors the couple actually used (not
 *  just considering/shortlisted). These are the "vendors who made this day". */
const COMMITTED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'];

/**
 * The marketplace vendors the couple booked for this event, hydrated as guest-
 * facing cards. Read server-side (admin) — a guest isn't a couple member, so
 * RLS on event_vendors wouldn't let them read it directly. Shown to guests as
 * "vendors who made this day", each savable to their own account (Invite/Join v2).
 */
export async function fetchEventVendorCredits(eventId: string): Promise<VendorCard[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, category, status')
    .eq('event_id', eventId)
    .in('status', COMMITTED_STATUSES)
    .not('marketplace_vendor_id', 'is', null);

  if (!rows || rows.length === 0) return [];

  const categoryByVendor = new Map<string, string | null>();
  const ids: string[] = [];
  for (const r of rows) {
    const vid = r.marketplace_vendor_id as string | null;
    if (!vid || categoryByVendor.has(vid)) continue;
    categoryByVendor.set(vid, (r.category as string | null) ?? null);
    ids.push(vid);
  }

  const cards = await hydrateVendorCards(ids, categoryByVendor);
  return ids.map((vid) => cards.get(vid)).filter((c): c is VendorCard => !!c);
}
