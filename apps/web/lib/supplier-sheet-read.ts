import 'server-only';
/**
 * supplier-sheet-read.ts — the two reads the supplier sheet makes when it is
 * OPEN (never on a plain page load): a supplier's newest reviews and their
 * completed events. Both through shipped readers; this only runs them together
 * and keeps "could not read" apart from "there are none".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchReviewsForVendor, fetchVendorCompletedEvents } from '@/lib/reviews';
import { sheetReviews, sheetWork, type SheetReview, type SheetWork } from '@/lib/supplier-sheet';

export type SupplierSheetProof = {
  /** `null` = the reviews could not be read — never the same as none. */
  reviews: SheetReview[] | null;
  /** The supplier's completed events. The reader is best-effort (it returns
   *  nothing on a failed read), so the sheet prints this section only when it
   *  holds something and never says "no events". */
  work: SheetWork[];
  /** How many completed events were read (the list above is capped). */
  workTotal: number;
};

export async function readSupplierSheetProof(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<SupplierSheetProof> {
  const [reviews, completed] = await Promise.all([
    // A few more than are shown: only reviews with words are listed.
    fetchReviewsForVendor(supabase, vendorProfileId, { limit: 12 })
      .then((rows) => sheetReviews(rows))
      .catch((err) => {
        console.error('[supplier-sheet] reviews read failed', err);
        return null;
      }),
    fetchVendorCompletedEvents(supabase, vendorProfileId).catch(() => []),
  ]);
  return { reviews, work: sheetWork(completed), workTotal: completed.length };
}
