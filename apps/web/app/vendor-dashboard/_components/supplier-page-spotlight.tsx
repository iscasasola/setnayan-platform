import { Suspense } from 'react';
import { TOURS, type SpotlightScript } from '@/lib/tours';
import { completeTour } from '@/lib/tour-actions';
import { supplierPageToursDue, type SupplierPageTourKey } from '@/lib/supplier-page-tours';
import { SupplierPageSpotlightMount } from './supplier-page-spotlight-mount';

/**
 * 🔦 THE FOUR SUPPLIER PAGE TOURS — Shop · Dates · Money · Hub (owner "Yes to all", 2026-10-22).
 *
 * A SERVER component, like `Spotlight`: it reads `lib/tours.ts` here and hands the client half only the
 * words of the tours this person has still to meet (`lib/tours-stay-on-the-server.test.ts`). `seenKeys`
 * is the `tour_seen_keys` the supplier layout already read — never a second read. Which one shows is
 * decided in the browser from the address (`supplierPageTourOn`), so it survives the Shop tour's walk
 * from Services into Page.
 *
 * 📦 Only the supplier layout mounts this — the Maker's first load never carries it.
 */
export function SupplierPageSpotlight({ seenKeys }: { seenKeys: ReadonlyArray<string> | null }) {
  const due = supplierPageToursDue(seenKeys);
  if (due.length === 0) return null;
  const scripts: Partial<Record<SupplierPageTourKey, SpotlightScript>> = {};
  for (const k of due) {
    const s = TOURS[k].spotlight;
    if (s) scripts[k] = s;
  }
  return (
    <Suspense fallback={null}>
      <SupplierPageSpotlightMount scripts={scripts} completeAction={completeTour} />
    </Suspense>
  );
}
