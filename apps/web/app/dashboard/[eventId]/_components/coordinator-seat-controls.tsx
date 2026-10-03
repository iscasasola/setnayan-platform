import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  resolveAreaLevel,
  type ModeratorPermissions,
} from '@/lib/delegate-areas';
import { peopleWithAccessHref } from '@/lib/people-with-access-href';

/**
 * A delegate seat's grants, SHOWN — and the one way to change them.
 *
 * ⚖ Owner 2026-10-03 ("People with access"): access is set per person, per
 * area, as Edit · View · Off, in ONE place — Event Details › People with
 * access. Every other screen that draws a seat SHOWS what it holds and links
 * there; none of them sets it. So the couple's controls that lived here
 * (`CoordinatorSeatControls`: "Allow budget view", "Allow event photos" and the
 * reasoned Remove, moved off the Hosts page on 2026-09-30) were MOVED to that
 * section — replace means remove, so they are gone from here.
 *
 * Where this is drawn:
 *   · the hired planner's seat — their supplier workspace
 *     (`promote-coordinator-card.tsx`);
 *   · a limited helper's seat — their guest card (`guest-helper-access.tsx`);
 *   · a delegate's own access view (`/hosts`).
 *
 * 🔑 NEVER FOR A FULL CO-HOST. A co-host seat is a `couple` member
 * (20271251336140) with the same access as the creator; nothing reads its
 * permissions_json, so a "Budget · off" chip on the Groom would be a lie.
 */

/*
 * Imports only pure modules (`delegate-areas`, not the server-only
 * `event-moderators`): the guest card that draws `ChangeAccessLink` is a
 * client component.
 */

/** What `permissions_json` grants a delegate seat, area by area. */
export function CoordinatorGrantChips({ permissions }: { permissions: ModeratorPermissions | null }) {
  const budgetLevel = resolveAreaLevel(permissions, 'budget');
  const grantChips = DELEGATE_AREAS.filter((a) => a !== 'budget')
    .map((a) => ({ area: a, level: resolveAreaLevel(permissions, a) }))
    .filter((g) => g.level !== null);
  return (
    <p className="flex flex-wrap gap-1">
      {grantChips.map((g) => (
        <span
          key={g.area}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            g.level === 'edit' ? 'bg-terracotta/10 text-terracotta-700' : 'bg-ink/5 text-ink/60'
          }`}
        >
          {DELEGATE_AREA_LABEL[g.area]}
          {g.level === 'view' ? ' · view' : ''}
        </span>
      ))}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          budgetLevel ? 'bg-ink/5 text-ink/60' : 'bg-ink/[0.03] text-ink/35'
        }`}
      >
        {DELEGATE_AREA_LABEL.budget} {budgetLevel ? '· view' : '· off'}
      </span>
    </p>
  );
}

/** The quiet door to the one place a seat's access is changed. Hosts only. */
export function ChangeAccessLink({ eventId }: { eventId: string }) {
  return (
    <Link
      href={peopleWithAccessHref(eventId)}
      className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-ink/55 hover:text-ink"
      data-change-access-link=""
    >
      Change in People with access
      <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
    </Link>
  );
}
