import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBatchVendorAvailableDays } from '@/lib/vendor-availability';

/**
 * Which of the couple's candidate dates each supplier is NOT marked busy on —
 * one batched calendar read over the candidates' span (the same helper the
 * engine's own date filter uses, `getBatchVendorAvailableDays`).
 *
 * "Free" = not marked busy. A supplier with no calendar is fully available by
 * the platform's V1 default, and a refused read fails OPEN (every date) — both
 * are the engine's existing behaviour, restated here so the card can say WHICH
 * dates (`lib/onboarding/venue-chain.ts` explains why the copy stays honest).
 */
export async function freeDatesByVendor(
  admin: SupabaseClient,
  vendorIds: readonly string[],
  dateKeys: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const keys = dateKeys.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).slice().sort();
  if (keys.length === 0 || vendorIds.length === 0) return out;
  const toDate = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  };
  const avail = await getBatchVendorAvailableDays(
    admin,
    [...vendorIds],
    toDate(keys[0]!),
    toDate(keys[keys.length - 1]!),
  );
  for (const id of vendorIds) {
    const free = avail.get(id);
    // Absent from the batch → failing-open, the same as the engine's filter.
    out.set(id, free ? keys.filter((k) => free.has(k)) : [...keys]);
  }
  return out;
}
