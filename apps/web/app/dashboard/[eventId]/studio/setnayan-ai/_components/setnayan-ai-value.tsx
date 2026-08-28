import {
  ListChecks,
  TrendingUp,
  CalendarX,
  AlertTriangle,
  CalendarClock,
  Wallet,
  PiggyBank,
  Eye,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import {
  type AiActivity,
  figureRanked,
  figureDeadlines,
  figureNextMove,
  figurePayments,
} from '@/lib/setnayan-ai-activity';
import {
  buildAiValueGroups,
  WEDDING_AI_VALUE_TERMS,
  type AiCapabilityId,
  type AiValueTerms,
} from './setnayan-ai-value-copy';

/**
 * SetnayanAiValue — the "everything Setnayan AI is keeping for you" surface,
 * shared by the studio page's ACTIVE and BUY/PAUSED states.
 *
 *   • mode="live"    → the assistant is on for this event. Each capability is
 *     annotated with a REAL per-event figure (drawn from `activity`, which is
 *     the same cockpit + upcoming-items data the Overview reads). Leads with the
 *     live briefing ("You're 62% locked in, 3 decisions need you …").
 *   • mode="preview" → the pitch. The same honest capability list described as
 *     what the assistant WILL keep for you — no live numbers, no fabricated
 *     ones.
 *
 * Every row is a WIRED, running capability (owner "no fake doors"). Designed-
 * but-dormant guards (price-drop, availability-change, contract windows, the
 * consent-gated trend/inference insights) are deliberately absent — they have
 * no live data source yet (see setnayan-ai-snapshot.ts).
 */

/**
 * Icon + live-figure per capability, keyed by the STABLE id from
 * setnayan-ai-value-copy.ts. The words live there (pure + unit-tested, and
 * varied per event type); this map holds only what can't be a string.
 * Keyed by id, never by title — a title is copy and copy moves.
 */
const CAP_ICON: Record<AiCapabilityId, typeof ListChecks> = {
  rank: ListChecks,
  deadlines: CalendarClock,
  next_move: Clock,
  payments: Wallet,
  budget: PiggyBank,
  demand: Eye,
  price_watch: TrendingUp,
  date_watch: CalendarX,
  schedule_clash: AlertTriangle,
};

const CAP_FIGURE: Partial<Record<AiCapabilityId, (a: AiActivity) => string>> = {
  rank: figureRanked,
  deadlines: figureDeadlines,
  next_move: figureNextMove,
  payments: figurePayments,
};


function Figure({ text }: { text: string }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mulberry/10 px-2.5 py-0.5 text-xs font-medium text-mulberry">
      <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
      {text}
    </span>
  );
}

/**
 * Column count by how many cards a group actually has. A LOOKUP, not a
 * template string: Tailwind scans source text, so `sm:grid-cols-${n}` compiles
 * to a class that exists in no stylesheet and silently does nothing — the
 * quietest kind of styling bug, and one nothing in CI would catch.
 */
const CAP_GRID: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

export function SetnayanAiValue({
  mode,
  activity = null,
  terms = WEDDING_AI_VALUE_TERMS,
}: {
  mode: 'live' | 'preview';
  activity?: AiActivity | null;
  /**
   * Event-type terminology + the statutory-pack fact, from EventTypeProfile.
   * Defaults to the wedding shape so an un-migrated caller renders exactly what
   * it rendered before this surface became type-aware.
   */
  terms?: AiValueTerms;
}) {
  const live = mode === 'live' && activity !== null;
  const groups = buildAiValueGroups(terms);
  const { eventWord } = terms;

  return (
    <div className="space-y-6">
      {/* Live briefing — the headline per-event number. Only in live mode. */}
      {live && activity ? (
        <div className="sn-tile space-y-3 p-5">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mulberry">
            <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
            Working right now
          </p>
          <p className="text-lg font-medium text-ink">
            {activity.cockpit.briefing.sentence}
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
            role="img"
            aria-label={`${activity.cockpit.briefing.lockedPct}% locked in`}
          >
            <div
              className="h-full rounded-full bg-mulberry transition-all"
              style={{ width: `${Math.max(2, Math.min(100, activity.cockpit.briefing.lockedPct))}%` }}
            />
          </div>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.heading} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{group.heading}</h2>
            <p className="text-sm text-ink/55">{group.blurb}</p>
          </div>
          {/*
            THE GRID FITS ITS OWN CONTENTS — it used to claim three columns
            whatever it held.

            ⚠ MEASURED, AND THE SHAPE IS NOT WHAT THE BRIEF SAID. The complaint
            was "eight cards in a 3-column grid, so the last row is one card and
            a hole". There are NINE caps and they are in THREE groups of 1, 2
            and 6 — so the holes are in the first two groups, where a lone card
            sat in a third of a row with two thirds of nothing beside it, and
            the six-card group was already tidy. Fixing the brief's version
            would have left both real holes exactly where they were.

            A one-item group is now one full-width card and a two-item group is
            two halves. Nothing is reordered, resized by hand or removed; the
            row simply stops declaring room it has nothing to put in.
          */}
          <ul className={`grid gap-3 ${CAP_GRID[Math.min(group.caps.length, 3)] ?? CAP_GRID[3]}`}>
            {group.caps.map(({ id, title, body }) => {
              const Icon = CAP_ICON[id];
              const liveFn = CAP_FIGURE[id];
              const figure = live && activity && liveFn ? liveFn(activity) : null;
              return (
                <li key={id} className="sn-row flex flex-col p-4">
                  <Icon aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
                  <p className="mt-2 text-sm font-medium text-ink">{title}</p>
                  <p className="mt-1 text-sm text-ink/65">{body}</p>
                  {figure ? <Figure text={figure} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* The "impossible by hand" close — the point of the whole surface. */}
      <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
        <p className="text-sm text-ink/75">
          {/*
            🔴 THIS USED TO SAY "never sleeps" — 2026-08-28, and it was not true.
            The guard sweep runs on a VISIT (`after(() => sweepGuardNotifications)`
            in the event layout, throttled to once per event per 6h). It is
            visit-driven, not a cron: this project has no scheduler. So the honest
            claim is that it is watching and tells you — the payment guard by
            email, the rest in the app — not that it works while you sleep.
            Shorter and truer at once, which is usually how over-claims read.
          */}
          {live ? (
            <>
              By hand this is re-checking every vendor, deadline and payment,
              every week until your {eventWord}. Setnayan AI keeps the list and
              tells you what moved.
            </>
          ) : (
            <>
              By hand this is re-checking every vendor, deadline and payment,
              every week until your {eventWord}. Setnayan AI holds it, so nothing
              slips while you’re living your life.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
