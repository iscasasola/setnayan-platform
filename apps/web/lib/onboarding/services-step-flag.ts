/**
 * Onboarding SERVICES STEP flag — the Papic + Setnayan AI cards.
 *
 * Gates the one shared step (`app/onboarding/_shared/services-step.tsx`) that all
 * three onboarding flows mount after the persona reveal / plan and before
 * `congrats`. Contract:
 *   • Papic card — informational only. Papic is ALREADY ON and free by the time
 *     the couple reaches it (the free grant is armed at every commit path), so
 *     the card states what's live and what an upgrade adds. No checkout.
 *   • Setnayan AI card — introduced, never given away, and hidden entirely on
 *     vendor-free types. Routes to the studio. No checkout.
 *
 * ⚠ This is NOT a re-opening of the paywall tail. The 2026-06-21 "no paywall in
 * onboarding" lock stands: `PAYWALL_SCREENS` (plan · services · summary) stays
 * filtered out of the wedding flow exactly as before. This step takes no money
 * and adds nothing to a cart — it is the FIRST time a couple is told Papic
 * exists, on a funnel where both products were previously invisible.
 *
 * OFF (default) ⇒ every flow renders byte-identical to today: the wedding
 * sequence drops the screen, the generic wizard drops it from its screen list,
 * and the simple page renders no card. The owner flips it.
 *
 * NEXT_PUBLIC_ so the server pages (which resolve the live catalog + the gate)
 * and the client wizards (which own the screen sequence) read ONE value and
 * cannot drift. NEXT_PUBLIC_* vars are BUILD-TIME INLINED, so a bare env flip
 * does nothing until a redeploy — which fails safe rather than half-open.
 */
export function onboardingServicesStepEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP;
  return v === 'true' || v === '1' || v === 'TRUE';
}
