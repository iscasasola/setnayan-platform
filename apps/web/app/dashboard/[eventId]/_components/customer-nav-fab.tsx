'use client';

import { UserPlus } from 'lucide-react';
import type { LifecyclePhase } from '@/lib/day-of-mode';
import { NavFab } from '@/app/_components/nav/nav-fab';

/**
 * CustomerNavFab — the couple doorway's broken-out primary action (NAV-2).
 *
 * Thin client wrapper that holds the doorway-specific action + Lucide icon
 * (mirrors the CustomerBottomNav pattern: the icon ref can't cross the
 * Server→Client boundary, so the layout passes only the eventId string and this
 * client component supplies the icon).
 *
 * Action = **Add guest** → `/guests/new`. Building the guest list is the couple's
 * single most-repeated action while planning, and it doesn't duplicate any pill
 * tab. Hidden in the `after` phase (no guests to add post-event); the NavFab
 * primitive additionally hides it whenever the docked SubNav is up.
 *
 * PROVISIONAL (owner to confirm): the per-doorway action choice. A phase-aware
 * variant (e.g. Day-of → check-in/scan) and the vendor/admin FABs are follow-ups.
 */
export function CustomerNavFab({
  eventId,
  phase = 'plan',
}: {
  eventId: string;
  phase?: LifecyclePhase;
}) {
  if (phase === 'after') return null;

  return (
    <NavFab
      href={`/dashboard/${eventId}/guests/new`}
      label="Add guest"
      icon={UserPlus}
    />
  );
}
