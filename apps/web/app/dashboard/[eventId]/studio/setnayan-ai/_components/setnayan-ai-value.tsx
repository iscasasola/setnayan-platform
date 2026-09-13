import { ShieldCheck, Sparkles } from 'lucide-react';
import {
  type AiActivity,
  figureRanked,
  figureDeadlines,
  figureNextMove,
  figurePayments,
} from '@/lib/setnayan-ai-activity';
import { Spotlights } from '@/app/_components/marketing/_spotlights';
import {
  buildAiValueSpotlights,
  WEDDING_AI_VALUE_TERMS,
  type AiValueTerms,
} from './setnayan-ai-value-copy';

/**
 * SetnayanAiValue — the "everything Setnayan AI is keeping for you" surface,
 * shared by the studio page's ACTIVE and BUY/PAUSED states.
 *
 *   • mode="live"    → the assistant is on for this event. Leads with the live
 *     briefing ("You're 62% locked in, 3 decisions need you …") and the REAL
 *     per-event figures drawn from `activity` — the same cockpit + upcoming-
 *     items data the Overview reads.
 *   • mode="preview" → the pitch. The same honest capabilities described as
 *     what the assistant WILL keep for you — no live numbers, no fabricated
 *     ones.
 *
 * ─── WHY THIS IS NO LONGER A GRID OF CARDS (2026-09-07) ───────────────────
 * Owner, looking at this page: *"this is just a bunch of rectangles with
 * information. it feel too wordy … we want to push a more image simple impact
 * on the description"* — pointing at the same rival features page that
 * produced `_spotlights.tsx` on 2026-08-29 and reshaped the eight public
 * doorways on 2026-09-05. The public `/setnayan-ai` page had already been
 * rebuilt that way. THIS page — the one that asks for money — had not: nine
 * near-identical bordered rectangles, ~300 words of prose, and not one picture
 * of the product anywhere on it.
 *
 * 🔑 RULE 0: THE RENDERER ALREADY EXISTED AND IS NOT WRITTEN AGAIN. This
 * composes `Spotlights` from `_components/marketing/_spotlights.tsx` — the
 * shipped kit, unchanged — and supplies only content. The pictures are the
 * stills of THIS product's own demo scenes (`studio-card-demo.tsx`,
 * captured by `scripts/capture-demo-stills.mjs`), which have existed since
 * the App Store card shipped and had never appeared on the buy page.
 *
 * ⛔ NINE PARAGRAPHS WENT AWAY. NINE PROMISES DID NOT. Every capability id is
 * claimed by exactly one spotlight via `caps`, and the copy test fails if one
 * is missed or double-claimed — so this page cannot get shorter by quietly
 * promising less. That distinction is the whole reason the mapping is data and
 * not prose.
 *
 * ⚠ THE ICON MAP IS GONE, DELIBERATELY. `CAP_ICON` existed to put a lucide
 * glyph on each of the nine cards; there are no cards. Its drift guard has
 * been REPLACED, not deleted — the test now asserts every id is covered by a
 * spotlight, which is the same protection against adding a capability nobody
 * shows, aimed at the thing that now does the showing.
 */

/** Live per-event figures, keyed by the capability the number belongs to. */
const LIVE_FIGURES: ReadonlyArray<{ label: string; of: (a: AiActivity) => string }> = [
  { label: 'Ranked', of: figureRanked },
  { label: 'Deadlines', of: figureDeadlines },
  { label: 'Next', of: figureNextMove },
  { label: 'Payments', of: figurePayments },
];

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
  const items = buildAiValueSpotlights(terms);
  const { eventWord } = terms;

  return (
    <div className="space-y-6">
      {/* Live briefing — the headline per-event number, then the real figures
          behind it. Only in live mode; the preview state shows no numbers at
          all rather than plausible-looking ones. */}
      {live && activity ? (
        <div className="sn-tile space-y-3 p-5">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mulberry">
            <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
            Working right now
          </p>
          <p className="text-lg font-medium text-ink">{activity.cockpit.briefing.sentence}</p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
            role="img"
            aria-label={`${activity.cockpit.briefing.lockedPct}% locked in`}
          >
            <div
              className="h-full rounded-full bg-mulberry transition-all"
              style={{
                width: `${Math.max(2, Math.min(100, activity.cockpit.briefing.lockedPct))}%`,
              }}
            />
          </div>
          <ul className="flex flex-wrap gap-2 pt-1">
            {LIVE_FIGURES.map(({ label, of }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-mulberry/10 px-2.5 py-0.5 text-xs font-medium text-mulberry"
              >
                <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                {of(activity)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        One idea, one picture, one sentence — the shared kit, composed rather
        than reimplemented. `Spotlights` alternates sides on wide screens on its
        own, so nothing here positions anything.

        The `caps` field each item carries is NOT rendered: it is the coverage
        contract the test reads, so the mapping from nine capabilities to four
        pictures lives in one place and is checkable.
      */}
      <Spotlights items={items} />

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
              By hand this is re-checking every vendor, deadline and payment, every week
              until your {eventWord}. Setnayan AI keeps the list and tells you what moved.
            </>
          ) : (
            <>
              By hand this is re-checking every vendor, deadline and payment, every week
              until your {eventWord}. Setnayan AI holds it, so nothing slips while you’re
              living your life.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
