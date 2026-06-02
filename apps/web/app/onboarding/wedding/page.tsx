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
import { OnboardingShell } from './_components/onboarding-shell';

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <OnboardingShell authed={!!user} resume={sp.resume === '1'} />;
}
