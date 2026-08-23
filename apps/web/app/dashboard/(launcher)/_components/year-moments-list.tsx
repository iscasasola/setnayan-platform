'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, CalendarHeart, Sparkles, Check, Plus } from 'lucide-react';

import { StartPlanningLink } from './start-planning-link';

/**
 * Serializable view of one "Your year" moment — the strings are precomputed on
 * the server (Asia/Manila) so the client never re-derives dates or timezones.
 */
export type YearMomentView = {
  key: string;
  isWedding: boolean;
  label: string;
  dateLabel: string;
  countdownLabel: string;
  isMilestone: boolean;
  /** Dashboard target when the moment belongs to an event; null = no navigation. */
  eventId: string | null;
  /**
   * ⚠ THE FOUR FIELDS BELOW ARE WHAT MAKES A ROW ACTIONABLE, and they were
   * missing here until 2026-08-21 — a moment with no event was a DEAD ROW that
   * printed a date and offered nothing to do about it. The affordance lived on
   * /dashboard/year, and retiring that page into this shelf without carrying
   * them would have deleted "start planning from a moment" from the product.
   */
  /** `event_type_vocab` key to preselect in the create flow, when known. */
  createEventType?: string | null;
  /** ISO day the moment falls on — handed to the wizard so it need not ask. */
  dateISO?: string | null;
  /** Is this moment about the reader themselves? */
  forSelf?: boolean;
  /** The age a birthday row turns — already printed on this row's own label. */
  age?: number | null;
};

/**
 * "Your year" list — shows the first few moments and expands the rest INLINE,
 * and carries a "See the year →" door to the full /dashboard/year calendar
 * (which also holds the holidays the home strip omits). The 2026-07-13 de-link
 * (home no longer navigates to /dashboard/year) is superseded by the owner's
 * 2026-07-15 "nothing orphaned" directive — the full Year view was left with no
 * in-app doorway, so the see-all row restores it. Moments tied to an event
 * still deep-link into that event's dashboard (an allowed jump); undated/derived
 * moments render as plain, non-navigating rows.
 */
export function YearMomentsList({
  moments,
  initial = 3,
}: {
  moments: YearMomentView[];
  initial?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? moments : moments.slice(0, initial);
  const hiddenCount = moments.length - initial;

  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((m) => (
          <li key={m.key}>
            <MomentRow moment={m} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep transition-colors hover:text-ink"
          >
            {showAll ? 'Show less' : `Show ${hiddenCount} more`}
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showAll ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : null}
        {/* The "See the year" door is GONE (owner 2026-08-21). It opened the
            full Year calendar for the holidays this list used to exclude —
            those are IN this list now, and /dashboard/year redirects here, so
            the link would send a person back to the page they are standing on.
            A door onto the room you are already in is worse than no door. */}
      </div>
    </div>
  );
}

function MomentRow({ moment: m }: { moment: YearMomentView }) {
  const Icon = m.isWedding ? Sparkles : CalendarHeart;
  /*
    ─── THE NAME WAS CUT TO "Y…" ON A PHONE (owner, seen on his own screen) ──

    MEASURED IN THE LIVE PAGE at 375px, not estimated. The row is 309px wide.
    Its icon (36) + gaps (42) + countdown (69) + "Start planning" (111) are ALL
    `shrink-0`, and the name column was `min-w-0` — so the only thing able to
    give way was the name, and it gave way to **17 pixels**. "Your birthday —
    turning 40" rendered as `Y…`, with its date beneath as `D…`.

    ⚠ AND IT WAS NOT ONLY THE START ROWS. Every one of the five rows on that
    screen was truncating; the two event rows merely had 142px instead of 17,
    so they read "Cale & Ice — your w…" and looked like a normal ellipsis
    rather than a defect.

    THE ROW WRAPS ON A PHONE. Nothing is hidden and nothing is shortened: the
    name takes the first line, the countdown and the marker drop to the second.
    Measured after the change: all five names fit completely.

    🔑 `min-w-[9rem]` IS WHAT MAKES IT WRAP AT ALL. `min-w-0` lets a flex item
    shrink to nothing, which is exactly what it did — a flex row shrinks before
    it wraps. Giving the column a floor means "there is no room" becomes true,
    and wrapping is what happens then. `sm:min-w-0` restores the shrink above
    the breakpoint so the one-line desktop design truncates as it always did.
  */
  const shell = [
    'flex flex-wrap items-center gap-3.5 rounded-xl border px-4 py-3 sm:flex-nowrap',
    m.isMilestone
      ? 'border-gold/40 bg-gold/[0.06]'
      : 'border-ink/10 bg-ink/[0.015]',
  ].join(' ');
  const inner = (
    <>
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          m.isMilestone ? 'bg-gold/15 text-gold-deep' : 'bg-ink/[0.06] text-ink/55',
        ].join(' ')}
      >
        <Icon aria-hidden className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-[9rem] flex-1 sm:min-w-0">
        <p className="truncate text-sm font-medium text-ink">{m.label}</p>
        <p className="truncate text-xs text-ink/50">{m.dateLabel}</p>
      </div>
      <span
        className={[
          'shrink-0 whitespace-nowrap text-xs font-medium',
          m.isMilestone ? 'text-gold-deep' : 'text-ink/45',
        ].join(' ')}
      >
        {m.countdownLabel}
      </span>
      {/* The state the row exists to answer: is this already an event of yours,
          or a date still waiting for one? BOTH branches always render — a row
          with no marker reads as "unknown", which is the one thing this line
          must never say. They are <span>s styled as buttons because the ROW is
          the link; nesting a <button> in an <a> is invalid and would split one
          tap target into two. */}
      {m.eventId ? (
        /*
          ⚠ IT USED TO BE `hidden … sm:inline-flex`, WHICH MADE THE COMMENT
          ABOVE FALSE ON EVERY PHONE. "Both branches always render" was the
          rule, and on a phone this branch rendered nothing — so an event the
          reader already has looked exactly like a date they had not started.
          It was hidden because the row had no room for it; now that the row
          wraps, it has room, and the stated rule is true at every width.
        */
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-ink/15 bg-white/70 px-2.5 py-1 text-xs font-medium text-ink/70">
          <Check aria-hidden className="h-3 w-3" />
          Open plan
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-mulberry px-2.5 py-1 text-xs font-medium text-cream">
          <Plus aria-hidden className="h-3 w-3" />
          Start planning
        </span>
      )}
    </>
  );

  const hover = m.isMilestone ? 'hover:bg-gold/[0.1]' : 'hover:bg-ink/[0.04]';

  // An event moment deep-links into that event's dashboard (an allowed jump);
  // everything else opens the create flow, preselecting the type when the
  // moment knows its own kind (the create page validates the key and ignores
  // anything unknown).
  // ⚠ THE EVENT LINK IS WRITTEN INLINE, NOT LIFTED INTO `href` BELOW, AND THAT
  // IS DELIBERATE. `lint-port-no-lost-controls` reads destinations STATICALLY
  // out of JSX attributes; hoisting this into a variable made the launcher stop
  // declaring `/dashboard/[seg]` and the guard reported a lost control that was
  // never actually lost. Keeping the literal where the scanner can see it costs
  // one duplicated template and keeps the guard able to catch the day somebody
  // really does delete this.
  if (m.eventId) {
    return (
      <Link
        href={`/dashboard/${m.eventId}`}
        className={`${shell} sn-press transition-colors ${hover}`}
      >
        {inner}
      </Link>
    );
  }

  const href = m.createEventType
    ? `/dashboard/create-event?event_type=${encodeURIComponent(m.createEventType)}`
    : '/dashboard/create-event';

  // 🔑 STARTING FROM A ROW HANDS THE CREATE FLOW WHAT THE ROW ALREADY KNEW —
  // the day, the type, and whether it is about the reader — so the wizard states
  // those instead of asking for them again (owner 2026-08-20: *"we already know
  // that it is for me and this is a specific time of event, so these information
  // don't need to be filled"*). The age rides in sessionStorage, never the URL:
  // a birthday is personal data.
  return (
    <StartPlanningLink
      age={m.age ?? null}
      celebrationISO={m.dateISO ?? null}
      className={`${shell} sn-press transition-colors ${hover}`}
      forSelf={m.forSelf === true}
      href={href}
    >
      {inner}
    </StartPlanningLink>
  );
}
