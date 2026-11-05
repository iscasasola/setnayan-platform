'use client';

import { useEffect } from 'react';
import { draftStorageKey } from '@/lib/supplier-page-draft';

/**
 * `/dev/supplier-lab?s=page&draft=1` — puts one waiting change in this lab shop's page draft, as if the supplier had
 * made it and left. Rendered BEFORE the page parts, so its effect runs first and the parts read the seeded draft.
 */
export function LabSeedDraft({ vendorId }: { vendorId: string }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(draftStorageKey(vendorId), JSON.stringify({ accent: 'sage', about: 'Fresh words for the lab.' }));
    } catch {
      /* private window — the lab simply shows no draft */
    }
  }, [vendorId]);
  return null;
}
