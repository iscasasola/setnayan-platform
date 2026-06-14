'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CalendarRange, CalendarClock } from 'lucide-react';

/**
 * ScheduleModeToggle — the segmented control at the top of /schedule that
 * switches between the two modes of the page (chrome redesign delta #3,
 * 2026-06-03):
 *
 *   Preparation │ Event Day
 *
 * Mode is URL-driven via `?view=preparation` / `?view=event-day` so it's
 * bookmarkable + SSR-resolved on the server (the page reads searchParams).
 * This client component owns ONLY the link rendering + active-state
 * highlight; it never lifts the editable Event-Day blocks UI into the
 * client. Each segment is a real <Link> (prefetched, accessible, works
 * without JS) that preserves the rest of the query string.
 *
 * `prepCount` lets the Preparation segment show a small count badge so the
 * couple knows there's something there before they tap.
 */

type Mode = 'preparation' | 'event-day';

export function ScheduleModeToggle({
  active,
  prepCount,
}: {
  active: Mode;
  prepCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(mode: Mode): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div
      role="tablist"
      aria-label="Schedule view"
      className="inline-flex w-full max-w-md rounded-xl border border-ink/10 bg-cream p-1 sm:w-auto"
    >
      <Segment
        key={`preparation-${active === 'preparation'}`}
        href={hrefFor('preparation')}
        isActive={active === 'preparation'}
        Icon={CalendarRange}
        label="Preparation"
        badge={prepCount > 0 ? prepCount : undefined}
      />
      <Segment
        key={`event-day-${active === 'event-day'}`}
        href={hrefFor('event-day')}
        isActive={active === 'event-day'}
        Icon={CalendarClock}
        label="Event Day"
      />
    </div>
  );
}

function Segment({
  href,
  isActive,
  Icon,
  label,
  badge,
}: {
  href: string;
  isActive: boolean;
  Icon: typeof CalendarRange;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={isActive}
      scroll={false}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
        isActive
          ? 'bg-ink text-cream shadow-sm sn-bounce'
          : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
      }`}
    >
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      <span>{label}</span>
      {badge !== undefined ? (
        <span
          className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${
            isActive ? 'bg-cream/20 text-cream' : 'bg-terracotta/15 text-terracotta'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
