'use client';

import { useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SpotlightMount } from '@/app/_components/spotlight-mount';
import type { SpotlightScript, TourKey } from '@/lib/tours';
import { supplierPageTourOn, type SupplierPageTourKey } from '@/lib/supplier-page-tours';

/**
 * The client half of `SupplierPageSpotlight`: the page tour that belongs to THIS address, if it is still
 * due. Keyed by the tour, so moving from Shop to Money swaps one mount for the other — and moving inside
 * Shop (Services → Page) keeps the same one running, which is what lets its first stop be a doorway.
 */
export function SupplierPageSpotlightMount({
  scripts,
  completeAction,
}: {
  scripts: Partial<Record<SupplierPageTourKey, SpotlightScript>>;
  completeAction: (tourKey: TourKey) => Promise<void>;
}) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  // Finished or skipped in THIS visit: a ref, not state, so the closing "You're set" card stays up — but
  // leaving and coming back before the layout re-reads `tour_seen_keys` never plays it a second time.
  const done = useRef(new Set<string>());
  const key = supplierPageTourOn(pathname, Object.fromEntries(params?.entries() ?? []));
  const script = key ? scripts[key] : undefined;
  if (!key || !script || done.current.has(key)) return null;
  return (
    <SpotlightMount
      key={key}
      tourKey={key}
      script={script}
      seen={false}
      completeAction={(k) => {
        done.current.add(k);
        return completeAction(k);
      }}
    />
  );
}
