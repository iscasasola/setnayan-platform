import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { filterFavoritableVendorIds } from '@/lib/vendor-favorite-gate';
import { hydrateVendorCards, type VendorCard } from '@/lib/vendor-cards';

/**
 * Library · vendors the user bookmarked at events they ATTENDED as a guest
 * (`guest_saved_vendors`), for their own future planning — distinct from
 * `fetchSavedVendors` (vendors in their own event plans). RLS scopes the read
 * to the user's own bookmarks; display hydration reuses the shared card path.
 */
export async function fetchAttendedSavedVendors(): Promise<VendorCard[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('guest_saved_vendors')
    .select('vendor_profile_id, saved_at')
    .order('saved_at', { ascending: false });

  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.vendor_profile_id as string).filter(Boolean);

  // Subscription gate (owner 2026-07-18): a bookmarked vendor whose paid sub has
  // lapsed is hidden — the guest_saved_vendors row is preserved and the card
  // returns on re-subscribe. No-op while the flag is OFF. See lib/vendor-favorite-gate.
  const admin = createAdminClient();
  const favoritable = await filterFavoritableVendorIds(admin, ids);
  const gatedIds = ids.filter((id) => favoritable.has(id));
  if (gatedIds.length === 0) return [];

  const cards = await hydrateVendorCards(gatedIds);
  return gatedIds.map((vid) => cards.get(vid)).filter((c): c is VendorCard => !!c);
}
