import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  foldServedWithRows,
  type PartnersYouServedWith,
  type ServedWithRow,
} from '@/lib/partners-you-served-with';

export * from '@/lib/partners-you-served-with';

/**
 * 🤝 The shops this supplier has SERVED A PAST EVENT WITH — the one shared reader (owner 2026-11-06: "cannot link until
 * they have served the same event"). Used by the partnerships page's propose picker, `proposePartnership`, and the
 * Analytics "Link up with suppliers you already work with" door.
 *
 * Reads `partners_you_served_with(p_vendor)` with the VIEWER's session — the function refuses a shop that is not the
 * caller's (`not_your_shop`), and the definition of "served together" lives only in the database
 * (`vendor_served_together_rows`), the same one the insert trigger enforces.
 *
 * A refused read returns `{ measured: false }` — never an empty list, which would read as "nobody yet".
 */
export async function readPartnersYouServedWith(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<PartnersYouServedWith> {
  const { data, error } = await supabase.rpc('partners_you_served_with', { p_vendor: vendorProfileId });
  if (error || !Array.isArray(data)) {
    logQueryError(
      'lib/partners-you-served-with.server.ts: rpc partners_you_served_with',
      error ?? new Error('non-array result'),
      { vendorProfileId },
      'graceful_degrade',
    );
    return { measured: false, partners: [] };
  }
  return { measured: true, partners: foldServedWithRows(data as ServedWithRow[]) };
}

/** Pairwise: has this supplier served a past event with `otherVendorProfileId`? `null` = could not tell. */
export async function servedTogetherWith(
  supabase: SupabaseClient,
  vendorProfileId: string,
  otherVendorProfileId: string,
): Promise<boolean | null> {
  const read = await readPartnersYouServedWith(supabase, vendorProfileId);
  if (!read.measured) return null;
  return read.partners.some((p) => p.vendorProfileId === otherVendorProfileId);
}
