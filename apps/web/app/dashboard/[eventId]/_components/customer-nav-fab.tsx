'use client';

import { usePathname } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
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
 * ✅ SETTLED 2026-08-23 — the action STAYS "Add guest". This line used to
 * label the choice unsettled and ask the owner to confirm it, which is how a
 * settled choice gets re-opened by the next reader who arrives. It is the
 * couple's most-repeated planning action and it duplicates no pill tab.
 *
 * ⚠ The exact old wording is deliberately NOT quoted here. A guard bans that
 * phrase from this file, and a comment repeating it would keep the guard red
 * over the very sentence that removed it.
 *
 * ⏭ Still genuinely open, and different: a phase-aware variant (Day-of →
 * check-in/scan) and the vendor/admin FABs. Those are follow-ups, not doubts
 * about this one.
 */
export function CustomerNavFab({
  eventId,
  phase = 'plan',
}: {
  eventId: string;
  phase?: MenuLifecyclePhase;
}) {
  const pathname = usePathname();
  if (phase === 'after') return null;
  // 📱 ONLY ON THE GUESTS PAGE (owner 2026-09-30, "the menu changes also on the
  // mobile view"): the round button is Guests' own action, so it shows where
  // the guests are — not over Home, Your Team or a service. Unmounting it also
  // clears `data-sn-fab`, so the four tabs spread across the full bar.
  if (pathname !== `/dashboard/${eventId}/guests`) return null;

  return (
    <NavFab
      href={`/dashboard/${eventId}/guests/new`}
      label="Add guest"
      icon={UserPlus}
    />
  );
}
