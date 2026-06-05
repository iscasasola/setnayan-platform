import Link from 'next/link';
import { Sparkles, SlidersHorizontal, Hand } from 'lucide-react';
import type { TasteChip } from '@/lib/personalized-menu';
import { setPlanningMode } from '../actions';

/**
 * MatchCriteriaStrip — the compact "Matching you on" band at the top of the
 * Services (Vendors) tab, plus the Guided ⇄ Manual planning-mode switch.
 *
 * Owner 2026-06-04: the couple's personalization — the curated criteria
 * Setnayan filters + sorts services by (date · region · ceremony · venue ·
 * guests · style · budget) — belongs WHERE they browse services. This strip
 * shows the gist as chips with a "Refine" affordance to the editable
 * Personalization page (/details).
 *
 * Owner 2026-06-05: a couple can turn off Setnayan's automated layer entirely
 * via Manual mode (`events.planning_mode = 'manual'`) — matching, suggestions
 * and reminders go quiet and they self-drive. This strip is the switch's home:
 * Guided shows the criteria + a subtle "switch to manual"; Manual collapses to
 * a slim "you're driving" bar with a one-tap switch back. The toggle is a
 * server-action <form> (no client JS). (Manual also hides Home's Today's-Focus
 * + deadlines; the in-accordion "% match" pills are gated in the follow-up.)
 *
 * Pure presentational server component. Chips come from `buildTasteChips`.
 */
export function MatchCriteriaStrip({
  eventId,
  chips,
  manual = false,
}: {
  eventId: string;
  chips: TasteChip[];
  manual?: boolean;
}) {
  const refineHref = `/dashboard/${eventId}/details`;
  const hasCriteria = chips.length > 0;

  // Manual mode — collapse to a slim "you're planning this yourself" bar with a
  // one-tap switch back to Guided. Criteria chips + matching are hidden.
  if (manual) {
    return (
      <section
        aria-label="Planning mode"
        className="rounded-2xl border border-ink/10 bg-cream/60 p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
              <Hand aria-hidden className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.75} />
              Manual mode
            </p>
            <p className="text-xs text-ink/55">
              You&rsquo;re planning this yourself — Setnayan&rsquo;s matching, suggestions &amp;
              reminders are off.
            </p>
          </div>
          <form action={setPlanningMode}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="mode" value="guided" />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/12 bg-paper px-3 py-1 text-[11px] font-medium text-terracotta transition-colors hover:bg-cream"
            >
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Switch to Guided
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="match-criteria-heading"
      className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="match-criteria-heading"
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
            Matching you on
          </h2>
          <p className="text-xs text-ink/55">
            {hasCriteria
              ? 'What Setnayan filters & sorts these services by.'
              : 'Add your wedding details so we can match services to you.'}
          </p>
        </div>
        {/* Refine — the full, editable Personalization page where every
            onboarding detail is documented and the governance-free basics
            (names · region · feel · budget) are editable inline. */}
        <Link
          href={refineHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/12 bg-paper px-2.5 py-1 text-[11px] font-medium text-terracotta transition-colors hover:bg-cream"
        >
          <SlidersHorizontal aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Refine
        </Link>
      </div>

      {hasCriteria ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip.label}
              className="rounded-full border border-ink/12 bg-paper px-3 py-1 text-xs text-ink/75"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Switch to manual — turns off Setnayan's matching, suggestions &
          reminders for this wedding (owner 2026-06-05). Server-action form. */}
      <form action={setPlanningMode} className="mt-3 border-t border-ink/10 pt-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="mode" value="manual" />
        <button
          type="submit"
          className="text-[11px] font-medium text-ink/45 underline-offset-2 transition-colors hover:text-ink/70 hover:underline"
        >
          Prefer to plan it yourself? Switch to manual &rarr;
        </button>
      </form>
    </section>
  );
}
