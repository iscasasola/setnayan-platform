import 'server-only';

import { Coins } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchEventPoolSizing, recommendedCredits } from '@/lib/papic-pool-sizing';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { papicCreditVerdict } from '@/lib/papic-credit-estimate';

/**
 * WHAT THIS CELEBRATION IS LIKELY TO WANT — shown where the money is watched.
 *
 * ── RULE 0: THIS INVENTS NOTHING ──────────────────────────────────────────
 * The recommendation already existed and was already unit-tested — it simply
 * was not on this page. `lib/papic-credit-estimate.ts` computes it, reading
 * `papic_event_pool_config`; since 2026-09-22 that config has one row per event
 * type, so a christening is no longer quoted a wedding's 150 credits a head.
 * Nothing here does arithmetic of its own.
 *
 * ── 🔑 IT SHOWS ITS WORKING ───────────────────────────────────────────────
 * "You need 21,900" is a number a couple can only accept or ignore. "146 guests
 * × 150 credits = 21,900" is a number they can ARGUE with — and arguing with it
 * is how they discover that the figure moves when they change who may shoot.
 * That matters more than usual here, because the credits block now sits ABOVE
 * the two blocks that size it; an inverted order is only honest while the
 * number visibly recomputes.
 *
 * ── ⚖ IT RECOMMENDS ONLY WHEN SHORT (owner 2026-08-30) ────────────────────
 * *"if they need to add more … not over not under. if their count is good, then
 * do not recommend."* A covered celebration is told it is covered and offered
 * nothing. `CreditVerdict` makes over-recommending unrepresentable rather than
 * merely discouraged — a `covered` verdict carries no top-up figure at all.
 *
 * ── ⚠ AND IT SAYS NOTHING RATHER THAN GUESSING ───────────────────────────
 * No guest count, or a refused read, renders NOTHING. A zero dressed up as "you
 * need no credits" is the failure this whole surface keeps paying for: an
 * absence that renders identically to a real answer.
 */
export async function CreditRecommendation({
  eventId,
  eventType,
}: {
  eventId: string;
  eventType: string | null;
}) {
  const admin = createAdminClient();

  const [sizing, headcount, pool] = await Promise.all([
    fetchEventPoolSizing(admin, eventType),
    admin.rpc('papic_event_guest_headcount', { p_event_id: eventId }),
    readEventPoolStatus(admin, eventId).catch(() => ({ ok: false as const, status: null })),
  ]);

  if (headcount.error) {
    logQueryError('CreditRecommendation.headcount', headcount.error, { eventId }, 'graceful_degrade');
    return null;
  }

  const guests = typeof headcount.data === 'number' ? headcount.data : 0;
  // 🔑 NO GUEST LIST, NO SENTENCE. "0 guests × 150 = 0" is arithmetic about
  // nothing, and it reads as a verdict on their celebration.
  if (guests <= 0) return null;

  const derivation = recommendedCredits(guests, sizing);
  const held = pool.ok && pool.status ? pool.status.totalPoints : 0;
  const verdict = papicCreditVerdict(held, guests, {
    pointsPerGuest: sizing.pointsPerGuest,
    floorPoints: sizing.floorPoints,
    ceilingPoints: sizing.ceilingPoints,
  });
  if (verdict.status === 'unknown') return null;

  const n = (x: number) => x.toLocaleString('en-PH');
  // ⚠ ONLY NAME THE TYPE WHEN THE TYPE'S OWN ROW ANSWERED. `sizedBy` is the row
  // that replied; claiming "for a christening" off the global fallback would be
  // a sentence about a decision nobody made.
  const sizedByType = sizing.sizedBy !== 'default';

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Coins aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        {verdict.status === 'covered'
          ? 'Your credits cover this celebration'
          : `Add ${n(verdict.shortfall)} credits to cover this celebration`}
      </p>

      {/* THE WORKING, not just the answer. */}
      <p className="font-mono text-[11.5px] text-ink/60">
        {n(guests)} {guests === 1 ? 'guest' : 'guests'} × {n(sizing.pointsPerGuest)} credits
        {sizedByType ? ` for a ${sizing.sizedBy.replace(/_/g, ' ')}` : ''} ={' '}
        {n(derivation.rawPoints)}
        {derivation.flooredUp
          ? ` · raised to ${n(derivation.basePoints)}, the least we suggest for a celebration this size`
          : derivation.cappedDown
            ? ` · held at ${n(derivation.basePoints)}, the most we suggest`
            : ''}
        {' · '}you hold {n(verdict.held)}
      </p>

      <p className="text-xs text-ink/55">
        {/* ⚠ SAY WHAT MOVES IT. The blocks that size this number now sit BELOW
            it, so a couple who changes coverage or allotments needs to know the
            figure follows them rather than being a fixed quote. */}
        This follows your guest list and the kind of celebration you are having — change
        who may shoot and it changes with them.
      </p>
    </section>
  );
}
