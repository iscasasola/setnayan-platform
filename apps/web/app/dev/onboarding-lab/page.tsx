/**
 * /dev/onboarding-lab — the wedding onboarding (the nine approved cards, the
 * shipped date screen, the services step, the finish) drawn by the REAL
 * `OnboardingShell`, inside its REAL `.onbw` wrapper with its REAL stylesheets,
 * with no sign-in and no database. DEV-ONLY: production builds 404 this route,
 * the same kill-switch as `/dev/home-lab`.
 *
 * Why it exists (owner's walk of the live flow, 2026-10-11): every defect was
 * LAYOUT — fields with no inner padding, a counter, title and line stacked with
 * no space, pills with no padding — and no unit test lays out. The cards were
 * right; a rule of the old onboarding sheet (`.onbw *{margin:0;padding:0}`) was
 * taking their spacing off. This page is where that is looked at, card by card.
 *
 * Nothing here is a copy: the profile is the code's own `WEDDING_PROFILE` with
 * the engine switched on (the seed's job in production), the cards are the ones
 * `resolveSetupSteps` resolves, the budget bands are the code's fallback, and
 * the price list is empty (a lab quotes nothing).
 *
 *   (no params)   the approved flow, signed-in shape (no account gate)
 *   ?authed=0     the signed-out shape — the account gate is in the flow
 *   ?legacy=1     the old sequence (the engine off) — every older `.onbw` screen
 *   ?services=0   without the services step's view (the screen draws nothing)
 *
 * To open on a given card without loading the page again (in the browser console):
 *   __onboardingLab.open({ step: 3 })        the fourth screen of the flow, on an empty draft
 *   __onboardingLab.open()                   start over
 * It writes the shell's own draft and mounts the shell afresh, which resumes from it.
 *
 * A PRESS HERE NEVER REACHES THE SERVER: `LabNoActions` refuses every server
 * action this page would send (the shell's commit creates a real event).
 */
import { notFound } from 'next/navigation';
import { OnboardingShell } from '@/app/onboarding/wedding/_components/onboarding-shell';
import { buildOnboardingPricing } from '@/app/onboarding/wedding/_components/onboarding-pricing';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { CREATION_ASKS, resolveSetupSteps } from '@/lib/onboarding/flow-config';
import { setupViewForProfile } from '@/lib/onboarding/setup-view';
import { buildServicesStepView } from '@/lib/onboarding/services-step-data';
import { LabNoActions } from './lab-no-actions';

export const dynamic = 'force-dynamic';

export default async function OnboardingLabPage({
  searchParams,
}: {
  searchParams: Promise<{ authed?: string; legacy?: string; services?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const legacy = q.legacy === '1';
  const setupView = legacy ? null : setupViewForProfile({ ...WEDDING_PROFILE, onboardingEngine: true });
  const setupSteps = setupView ? resolveSetupSteps(setupView, CREATION_ASKS.wedding) : [];
  // The services step with the free allowance only: no pack and no price is listed, so nothing is quoted.
  const servicesStepView =
    q.services === '0'
      ? null
      : buildServicesStepView({
          eventWord: WEDDING_PROFILE.terminology.eventWord,
          poolTiers: [],
          oneTiers: [],
          pricePhpByCode: new Map(),
          freePoolPoints: 0,
          freeOnePoints: 0,
          aiPricePhp: null,
        });
  return (
    <LabNoActions>
      <OnboardingShell
        setupView={setupView}
        setupSteps={setupSteps}
        servicesStepView={servicesStepView}
        authed={q.authed !== '0'}
        resume={false}
        activeFaiths={null}
        pricing={buildOnboardingPricing([], [], null, 0)}
      />
    </LabNoActions>
  );
}
