/**
 * /onboarding/wedding — V2 production port of the locked prototype
 * Onboarding_Wedding_Flow_2026-06-01.html.
 *
 * WHY: Owner directive 2026-06-02 (CLAUDE.md decision log) — deploy the
 * locked onboarding prototype as the wedding-creation flow for both entry
 * points: (a) marketing /signup → onboarding for first-time visitors,
 * (b) /dashboard/create-event → pick Wedding → onboarding for signed-in
 * customers. Cutover locked (replace the existing create-event Wedding form).
 *
 * Phase 1 ships:
 *   - Schema migration for the 12 new event columns (forward-prep for Phase 4)
 *   - This route + OnboardingShell client component (state + localStorage)
 *   - Screens 0-3 (Welcome · Role · Kind · Faith) ported with Clean Editorial
 *
 * The page itself is a thin Server Component — all interactivity, state,
 * and localStorage resume live in the OnboardingShell client component.
 * Entry-point wiring (/signup post-create redirect + /dashboard/create-event
 * Wedding tile) lands in Phase 5. For Phase 1 the route is reachable directly
 * but NOT linked from any production surface yet.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { getSelfPersonalization } from '@/lib/self-personalization';
import { fetchActiveCeremonyTypes } from '@/lib/religion-readiness';
import { fetchV2CustomerCatalog, fetchV2BundleCatalog } from '@/lib/v2-catalog';
import {
  fetchOnboardingBgMusicUrl,
  fetchOnboardingBgMusicUrls,
} from '@/lib/platform-settings';
import { getOnboardingRefinements, getOnboardingTiles } from '@/lib/onboarding-refinements';
import { getBudgetBands } from '@/lib/budget-bands';
import { hiddenOnboardingExtraCats } from '@/lib/onboarding-availability';
import { onboardingServicesStepEnabled } from '@/lib/onboarding/services-step-flag';
import { readServicesStepView } from '@/lib/onboarding/services-step-server';
import { resolveProfile } from '@/lib/event-type-profile';
import { SetnayanAiValue } from '@/app/dashboard/[eventId]/studio/setnayan-ai/_components/setnayan-ai-value';
import { getInPlanningWedding } from '@/app/dashboard/(account)/create-event/wedding-guard';
import { OnboardingShell } from './_components/onboarding-shell';
import { buildOnboardingPricing } from './_components/onboarding-pricing';

/**
 * Force dynamic rendering · skip static prerender (mirrors /pricing/page.tsx).
 *
 * WHY (owner directive 2026-06-08 — onboarding reads live admin pricing):
 * this page now calls fetchV2CustomerCatalog / fetchV2BundleCatalog, which
 * call createAdminClient(). That throws "Missing SUPABASE env vars for admin
 * client" when SUPABASE_SERVICE_ROLE_KEY is unset — the case in CI's
 * `production build` step. Static prerender would invoke the page at build
 * time, hit the throw, and fail the build (the "endless loop" of red CI). The
 * fetchers already try/catch → return [] so the page degrades gracefully, but
 * force-dynamic is the documented guard AND guarantees admin price edits
 * propagate live with no ISR cache (so we needn't add this route to the admin
 * revalidate list).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plan your wedding',
  description:
    "A few quick questions and we'll build a plan made for your day — every vendor sorted to fit. Free to start, always.",
  // Onboarding sits behind a CTA (marketing "Start planning · free" +
  // dashboard "Add event → Wedding"); keep the half-flow out of search.
  robots: { index: false, follow: false },
  alternates: { canonical: '/onboarding/wedding' },
};

/**
 * Phase 5 cutover (CLAUDE.md 2026-06-02): the route is now LIVE behind both
 * entry points. Two flags pass into the client shell:
 *   - authed: signed-in customers (dashboard "Add event → Wedding") SKIP the
 *     account screen (11); anonymous marketing visitors hit it as the auth gate.
 *   - resume: after an anonymous visitor authenticates at the account gate, the
 *     existing OAuth/signup `next` round-trip returns them to
 *     /onboarding/wedding?resume=1 — the shell restores the localStorage draft
 *     and advances past the (now-satisfied) account gate to find-vendor.
 * The lazy DB commit (events + event_members) fires once at the final button,
 * always with an authenticated user — see ./actions.ts commitOnboardingWedding.
 */
export default async function OnboardingWeddingPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string; next?: string }>;
}) {
  const sp = await searchParams;
  // Optional vendor-invite return path (2026-06-30): a 0-event couple sent here
  // from /vendor-invite/[slug] to create their first event is returned to it
  // after the commit so they can finish shortlisting the vendor. safeNext()
  // keeps it to internal paths only.
  const nextPath = safeNext(sp.next);
  const supabase = await createClient();

  // Wedding cardinality grey-out (owner ruling 2026-09-11 — "they shouldn't
  // even allow the creation/step 1 of clicking the wedding event... it should
  // be greyed out since it is not available"). Checked FIRST, before any of
  // the onboarding data fetches below, so a signed-in account with a wedding
  // still IN PLANNING never walks a single screen of the wizard — it lands on
  // this notice instead. Signed-out visitors are unaffected (getInPlanningWedding
  // is only ever called with a real user id). Same rule, same helper the
  // create-event picker uses — see wedding-guard.ts (owner-locked 2026-07-12).
  const {
    data: { user: earlyUser },
  } = await supabase.auth.getUser();
  const inPlanningWedding = earlyUser
    ? await getInPlanningWedding(supabase, earlyUser.id)
    : null;
  if (inPlanningWedding) {
    return <AlreadyPlanningWedding wedding={inPlanningWedding} />;
  }

  // Fetch the active wedding religions alongside auth so the faith picker can
  // gate on the launch status (admin /admin/wedding-types flips these). Returns
  // null on any read error → the shell falls back to its built-in soon flags.
  // `user` is already resolved above (the cardinality check needed it first).
  const user = earlyUser;
  const [activeFaiths, customerSkus, bundles, bgMusicUrl, bgMusicUrls, refinements, hiddenCats, dynamicTiles, budgetBands] = await Promise.all([
    fetchActiveCeremonyTypes(supabase),
    fetchV2CustomerCatalog(),
    fetchV2BundleCatalog(),
    // Owner-uploaded onboarding background music (owner 2026-06-08). Null when
    // unset/disabled/no service-role env → the shell's player never mounts.
    fetchOnboardingBgMusicUrl(),
    fetchOnboardingBgMusicUrls(),
    // DB-backed refinement catalogue (owner 2026-06-08, items 8 + 9). DB-first,
    // falls back to the static REFINEMENTS_DATA module on any read error/empty.
    getOnboardingRefinements('wedding'),
    // Available-only picker filter (spec §0): extras cats with no live marketplace
    // supply to hide. [] (never-gut) until the marketplace covers ≥half the cats.
    hiddenOnboardingExtraCats(),
    // Taxonomy-driven PICK step (2026-06-17): tier-2 tiles scoped to weddings from
    // service_categories. [] on error → shell falls back to static PICK_GROUPS_FALLBACK.
    getOnboardingTiles('wedding'),
    // Admin-tunable budget feel-bands (owner 2026-06-19, screen 9). DB-first,
    // falls back to BUDGET_BANDS_FALLBACK on any read error/empty.
    getBudgetBands(),
  ]);
  // Build the onboarding pricing view-model from the live admin catalog. No
  // committed event yet (lazy commit at the final button) → estimated_pax is
  // unknown → pass no pax. No live SKU is pax-priced since the 2026-07-29
  // two-type Papic reprice (PAPIC_GUEST is now a flat ₱1,000 pool top-up), so
  // every label renders as a flat "₱X" — matching /pricing's public behavior.
  // The authoritative charge is still recomputed server-side at order time by
  // resolvePaxPricedOrderCentavos in submitOrderAction (unchanged).
  const pricing = buildOnboardingPricing(customerSkus, bundles);

  // Date-anchor model: pre-select the faith on a Religious wedding from the
  // user's OWN profile religion (reference-only, opt-in). Only when it maps to
  // an ACTIVE ceremony faith — never pre-select an inactive/coming-soon faith.
  // The shell applies this only on the "Religious" kind and never overrides a
  // resumed draft.
  let religionDefault: string | null = null;
  if (user) {
    // Shared self-profile reader (2026-07-13) — same religion value as the prior
    // inline `users` select, now via one canonical helper reused across flows.
    const { religion } = await getSelfPersonalization();
    if (religion && (activeFaiths ?? []).includes(religion)) religionDefault = religion;
  }

  // The services step (Papic + Setnayan AI), resolved server-side because the
  // shell is a client component. Flag OFF ⇒ null ⇒ the shell drops the screen
  // from buildSequence and this flow is byte-identical to today.
  let servicesStepView = null;
  let servicesStepAiValue = null;
  if (onboardingServicesStepEnabled()) {
    servicesStepView = await readServicesStepView(supabase, 'wedding');
    if (servicesStepView.ai != null) {
      const profile = await resolveProfile('wedding');
      servicesStepAiValue = (
        <SetnayanAiValue
          mode="preview"
          terms={{
            eventWord: profile.terminology.eventWord,
            organizerNoun: profile.terminology.organizerNoun,
            hasStatutoryPaperwork: profile.statutoryPackKey != null,
          }}
        />
      );
    }
  }

  return (
    <OnboardingShell
      servicesStepView={servicesStepView}
      servicesStepAiValue={servicesStepAiValue}
      authed={!!user}
      resume={sp.resume === '1'}
      activeFaiths={activeFaiths}
      religionDefault={religionDefault}
      pricing={pricing}
      bgMusicUrl={bgMusicUrl}
      bgMusicUrls={bgMusicUrls}
      refinements={refinements}
      hiddenCats={hiddenCats}
      dynamicTiles={dynamicTiles}
      budgetBands={budgetBands}
      nextPath={nextPath !== '/' ? nextPath : null}
    />
  );
}

/**
 * The entrance notice for a signed-in account that already has a wedding IN
 * PLANNING (owner ruling 2026-09-11). Replaces the ENTIRE wizard — no screen
 * of it renders, not even Welcome — because the rule (wedding-guard.ts,
 * owner-locked 2026-07-12) is unconditional: at most one wedding in planning
 * at a time. "Start" is visibly unavailable with the plain reason; the way
 * forward is the existing wedding, exactly as the create-event picker's own
 * guided router (event-type-picker.tsx) already offers.
 */
function AlreadyPlanningWedding({
  wedding,
}: {
  wedding: { eventId: string; displayName: string };
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">
        Plan your wedding
      </p>
      <h1 className="mt-3 font-serif text-3xl italic text-ink sm:text-4xl">
        You’re already planning a wedding
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink/70">
        You have <span className="font-medium text-ink">{wedding.displayName}</span> in planning
        right now — you can only plan one wedding at a time, so starting another isn’t offered
        here. Finish it first, or open it and choose “Put this away” to free the slot.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-mulberry px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mulberry-600"
          href={`/dashboard/${wedding.eventId}`}
        >
          Go to {wedding.displayName}
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-lg border border-ink/12 px-5 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-ink/25 hover:text-ink"
          href="/dashboard?hub=1"
        >
          Back to my events
        </Link>
      </div>

      {/* The unavailable "start" affordance itself — greyed, not a dead link:
          it names the reason inline rather than pretending the wizard begins
          here. No control routes into the wizard from this screen. */}
      <div
        aria-hidden
        className="mt-10 flex cursor-not-allowed items-center justify-between rounded-xl border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-4 opacity-60"
      >
        <span className="text-sm font-medium text-ink/60">Start planning a wedding</span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">
          Not available
        </span>
      </div>
    </div>
  );
}
