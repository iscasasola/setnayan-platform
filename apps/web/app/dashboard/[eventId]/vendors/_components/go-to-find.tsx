'use client';

/**
 * GoToFind — an empty body's first action (2026-10-12 look sweep, brief rule 1:
 * "Empty state gives the first action"). The Build body's "Nothing to book yet"
 * and the Booked body's "No suppliers yet" are server-drawn, and the Suppliers
 * shell switches bodies only over its shipped bus (`goToBuildTab` → BB_TAB_EVENT,
 * heard by `services-takeover.tsx`). A `?tab=shortlist` link would not do it on a
 * soft navigation — the shell reads `initialTab` once — so this one island asks
 * the bus for Find instead.
 */
import { Search } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { goToBuildTab } from '@/lib/budget-build';

export function GoToFind({ className }: { className?: string }) {
  return (
    <ActionButton
      tone="brand"
      main
      icon={Search}
      label="Find a supplier"
      onClick={() => goToBuildTab('shortlist')}
      className={className}
    />
  );
}
