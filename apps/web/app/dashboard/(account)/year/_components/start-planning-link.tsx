'use client';

import Link from 'next/link';

import { stashMoment } from '@/lib/onboarding/moment-handoff';

/**
 * The "Start planning" card on /dashboard/year — a plain link that first hands
 * the create flow what this row already knew.
 *
 * A Year row is DERIVED from facts on the account, so tapping it should not
 * re-ask them (owner 2026-08-20: "we already know that it is for me and this is
 * a specific time of event, so these information don't need to be filled").
 * The type rides in the href (`?event_type=`, the param the create page already
 * validates); the DAY and "this is mine" ride in sessionStorage, because a
 * birthday is personal data and personal data does not go in a URL — the same
 * rule and the same mechanism as the honoree carry.
 *
 * It stays a real <Link>: the stash is a side effect ON TOP of navigation, never
 * a precondition for it. Private mode, a full quota or a disabled sessionStorage
 * all degrade to the wizard asking — which is exactly today's behaviour — rather
 * than to a card that does nothing when tapped.
 */
export function StartPlanningLink({
  href,
  celebrationISO,
  forSelf,
  age,
  className,
  children,
}: {
  href: string;
  celebrationISO: string | null;
  forSelf: boolean;
  /** The age a birthday row turns — already on this card's own label. */
  age: number | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={className}
      href={href}
      onClick={() => stashMoment({ celebrationISO, forSelf, age })}
    >
      {children}
    </Link>
  );
}
