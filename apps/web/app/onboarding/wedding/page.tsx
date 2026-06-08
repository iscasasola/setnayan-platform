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
import { createClient } from '@/lib/supabase/server';
import { fetchActiveCeremonyTypes } from '@/lib/religion-readiness';
import { fetchV2CustomerCatalog, fetchV2BundleCatalog } from '@/lib/v2-catalog';
import { fetchOnboardingBgMusicUrl } from '@/lib/platform-settings';
import { getOnboardingRefinements } from '@/lib/onboarding-refinements';
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
  title: 'Plan your wedding · Setnayan',
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
  searchParams: Promise<{ resume?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  // Fetch the active wedding religions alongside auth so the faith picker can
  // gate on the launch status (admin /admin/wedding-types flips these). Returns
  // null on any read error → the shell falls back to its built-in soon flags.
  const [userRes, activeFaiths, customerSkus, bundles, bgMusicUrl, refinements] = await Promise.all([
    supabase.auth.getUser(),
    fetchActiveCeremonyTypes(supabase),
    fetchV2CustomerCatalog(),
    fetchV2BundleCatalog(),
    // Owner-uploaded onboarding background music (owner 2026-06-08). Null when
    // unset/disabled/no service-role env → the shell's player never mounts.
    fetchOnboardingBgMusicUrl(),
    // DB-backed refinement catalogue (owner 2026-06-08, items 8 + 9). DB-first,
    // falls back to the static REFINEMENTS_DATA module on any read error/empty.
    getOnboardingRefinements(),
  ]);
  const user = userRes.data.user;
  // Build the onboarding pricing view-model from the live admin catalog. No
  // committed event yet (lazy commit at the final button) → estimated_pax is
  // unknown → pass no pax → PAPIC_GUEST renders "from ₱2,999" via
  // formatSkuPriceLabel (matches /pricing's public no-pax behavior). The
  // authoritative pax charge is still recomputed server-side at order time by
  // resolvePaxPricedOrderCentavos in submitOrderAction (unchanged).
  const pricing = buildOnboardingPricing(customerSkus, bundles);
  return (
    <OnboardingShell
      authed={!!user}
      resume={sp.resume === '1'}
      activeFaiths={activeFaiths}
      pricing={pricing}
      bgMusicUrl={bgMusicUrl}
      refinements={refinements}
    />
  );
}
