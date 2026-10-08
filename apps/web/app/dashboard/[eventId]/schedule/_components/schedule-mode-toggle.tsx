'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Route, CalendarRange, CalendarClock } from 'lucide-react';
import { PillThumb } from '@/app/_components/pill-selector';
import { I_SEGMENTED_CLASS, iSegClass } from '../../website/editor/_components/inspector-kit';

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
 * row behind the guided Schedule step) — the `ISegmented` track and `ISeg`'s
 * look, the chosen segment in Setnayan wine — kept as LINKS (above).
 */

type Mode = 'journey' | 'preparation' | 'event-day';

const VIEWS: { mode: Mode; label: string; Icon: typeof Route }[] = [
  { mode: 'journey', label: 'Journey', Icon: Route },
  { mode: 'preparation', label: 'Preparation', Icon: CalendarRange },
  { mode: 'event-day', label: 'Event Day', Icon: CalendarClock },
];

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

  /* 🔗 EACH VIEW IS A LINK (review 2026-10-05): a view has its own address, so
     it opens in a new tab, deep-links and comes back on Back — the segmented
     control's LOOK (\`iSegClass\`, the one \`ISeg\` wears), never its button. */
  function hrefFor(mode: Mode): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    return `${pathname}?${params.toString()}`;
  }

  const counts: Partial<Record<Mode, number>> = { journey: journeyCount, preparation: prepCount };

  return (
    <nav aria-label="Schedule view" className="w-full max-w-md sm:w-auto" data-schedule-view-switch="">
      <div className={I_SEGMENTED_CLASS}>
        {/* The one thumb that travels between the views (owner 2026-10-08: "and make them animate") — it finds the
            picked link by its `aria-current="page"`. */}
        <PillThumb />
        {VIEWS.map(({ mode, label, Icon }) => {
          const on = mode === active;
          const n = counts[mode] ?? 0;
          return (
            <Link
              key={mode}
              href={hrefFor(mode)}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              data-seg={`schedule-view-${mode}`}
              className={iSegClass(on, 'wine')}
            >
              <Icon aria-hidden className="h-4 w-4 max-sm:hidden" strokeWidth={1.75} />
              {label}
              {n > 0 ? (
                <span
                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                    on ? 'bg-white/25 text-white' : 'bg-terracotta/15 text-terracotta'
                  }`}
                >
                  {n}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
