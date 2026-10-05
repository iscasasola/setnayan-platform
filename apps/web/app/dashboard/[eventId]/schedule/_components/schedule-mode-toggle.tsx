'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Route, CalendarRange, CalendarClock } from 'lucide-react';
import { ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';

/**
 * ScheduleModeToggle — the segmented control at the top of /schedule that
 * switches between the three modes of the page (chrome redesign delta #3,
 * 2026-06-03; Journey added 2026-07-11):
 *
 *   Journey │ Preparation │ Event Day
 *
 * Mode is URL-driven via `?view=journey` / `?view=preparation` /
 * `?view=event-day` so it's bookmarkable + SSR-resolved on the server (the
 * page reads searchParams). This client component owns ONLY the link
 * rendering + active-state highlight; it never lifts the editable Event-Day
 * blocks UI into the client. Each segment is a real <Link> (prefetched,
 * accessible, works without JS) that preserves the rest of the query string.
 *
 * `prepCount` / `journeyCount` let those segments show a small count badge so
 * the couple knows there's something there before they tap.
 *
 * 🎚 THE ONE SEGMENTED CONTROL (DECISION_LOG 2026-10-04 "ONE SEGMENTED CONTROL
 * FOR SECTIONS, ACROSS THE APP"; owner, live walk 2026-10-05: this was a pill
 * row behind the guided Schedule step) — `ISegmented`, the chosen segment in
 * Setnayan wine. A tap swaps the view in place (`router.replace`, no scroll).
 */

type Mode = 'journey' | 'preparation' | 'event-day';

export function ScheduleModeToggle({
  active,
  prepCount,
  journeyCount,
}: {
  active: Mode;
  prepCount: number;
  journeyCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function go(mode: Mode) {
    if (mode === active) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const badge = (n: number, on: boolean) =>
    n > 0 ? (
      <span
        className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${
          on ? 'bg-white/25 text-white' : 'bg-terracotta/15 text-terracotta'
        }`}
      >
        {n}
      </span>
    ) : null;

  return (
    <div className="w-full max-w-md sm:w-auto" data-schedule-view-switch="">
      <ISegmented label="Schedule view">
        <ISeg tone="wine" on={active === 'journey'} onClick={() => go('journey')} data="schedule-view-journey">
          <Route aria-hidden className="h-4 w-4 max-sm:hidden" strokeWidth={1.75} />
          Journey
          {badge(journeyCount, active === 'journey')}
        </ISeg>
        <ISeg tone="wine" on={active === 'preparation'} onClick={() => go('preparation')} data="schedule-view-preparation">
          <CalendarRange aria-hidden className="h-4 w-4 max-sm:hidden" strokeWidth={1.75} />
          Preparation
          {badge(prepCount, active === 'preparation')}
        </ISeg>
        <ISeg tone="wine" on={active === 'event-day'} onClick={() => go('event-day')} data="schedule-view-event-day">
          <CalendarClock aria-hidden className="h-4 w-4 max-sm:hidden" strokeWidth={1.75} />
          Event Day
        </ISeg>
      </ISegmented>
    </div>
  );
}
