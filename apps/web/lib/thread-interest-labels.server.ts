import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { interestChipLabel } from '@/lib/thread-interests';

/**
 * thread-interest-labels.server — the words "Inquiring about …" uses, in ONE
 * place for every surface that prints them (owner's test round 1, 2026-09-11).
 *
 * The chip on the thread, the couple's conversation list, the supplier's rail
 * and the supplier's inbox list each labelled an interest their own way — three
 * of them from the COARSE category_key alone, which is copied from the booking
 * row: a Live Band card read "Band / DJ", and an interest written before the
 * 2026-09-08 save fix read "Miscellaneous". The linked card knows what it is.
 *
 * Label-only read of `vendor_services` (title + category) on the caller's
 * admin client — the same enrichment the chip always did: the name of a service
 * the couple already saw on the shop. Graceful: a failed read labels from the
 * category_key, never blank.
 */
export type InterestForLabel = { category_key: string | null; vendor_service_id: string | null };

export async function interestLabeller(
  admin: SupabaseClient,
  interests: readonly InterestForLabel[],
): Promise<(row: InterestForLabel) => string> {
  const ids = Array.from(
    new Set(interests.map((r) => r.vendor_service_id).filter((v): v is string => typeof v === 'string')),
  );
  const cards = new Map<string, { title: string | null; category: string | null }>();
  if (ids.length > 0) {
    try {
      const { data } = await admin
        .from('vendor_services')
        .select('vendor_service_id, title, category')
        .in('vendor_service_id', ids);
      for (const s of (data ?? []) as Array<{ vendor_service_id: string; title: string | null; category: string | null }>) {
        cards.set(s.vendor_service_id, { title: s.title, category: s.category });
      }
    } catch {
      /* label-only enrichment — degrade to category_key labels */
    }
  }
  return (row) => {
    const card = row.vendor_service_id ? cards.get(row.vendor_service_id) : undefined;
    return interestChipLabel(row, card?.title ?? null, card?.category ?? null);
  };
}
