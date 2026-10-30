import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { CoupleLook } from '@/lib/service-card-view-model';

/**
 * 📸 THE SERVICE CARD'S "FROM COUPLES" PHOTOS — ONE batched read for a whole gallery of cards (owner 2026-10-30,
 * DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A SUPPLIER'S INSPIRATION …").
 *
 * 🔑 It reads ONLY `service_card_couple_photos(ids)` (migration 20271297221336), which returns APPROVED shares whose
 * board photo is still on the couple's board and whose card is active. A waiting, declined or withdrawn photo cannot
 * come back from it — so no caller can forget the filter. Never a direct `couple_photo_shares` select from a public
 * page (`a-couples-photo-shows-only-when-approved.test.ts`).
 *
 * Fail-soft: a refused read logs and returns an empty map — the card renders exactly as it did before this feature.
 */
export const COUPLE_LOOKS_PER_CARD = 6;

export async function fetchServiceCardCouplePhotos(
  client: SupabaseClient,
  vendorServiceIds: readonly string[],
): Promise<Map<string, CoupleLook[]>> {
  const out = new Map<string, CoupleLook[]>();
  if (vendorServiceIds.length === 0) return out;
  const { data, error } = await client.rpc('service_card_couple_photos', { p_vendor_service_ids: [...vendorServiceIds] });
  if (error) {
    logQueryError('fetchServiceCardCouplePhotos', error, { n: vendorServiceIds.length }, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as Array<{ vendor_service_id: string; share_id: string; image_url: string; credit_line: string }>) {
    const list = out.get(r.vendor_service_id) ?? [];
    if (list.length >= COUPLE_LOOKS_PER_CARD) continue;
    list.push({ id: r.share_id, url: r.image_url, credit: r.credit_line });
    out.set(r.vendor_service_id, list);
  }
  return out;
}
