/**
 * 🚪 THE WAY OUT OF AN ONBOARDING FLOW'S FIRST SCREEN (owner 2026-10-26, verbatim:
 * "i noticed event onboarding doesn't have a cancel. so when they misclick that event
 * type. they can cancel").
 *
 * On the first screen there is nothing to step back to, so the top-left control that
 * is "‹" (step back) on every later screen becomes "✕" (leave) here — the house rule
 * that a first screen's top-left "<" is an exit icon. It goes back to the event-type
 * picker the person came from, so a misclicked type is one tap from the right one.
 *
 * Nothing is created by leaving: every flow commits once, at its final button
 * (`commitOnboardingWedding`, `commitOnboardingEvent`, `commitSimpleEvent`). What was
 * typed stays in the browser's own draft, exactly as if they had pressed Back.
 *
 * A signed-out visitor did not come from the picker (it is behind sign-in — they came
 * from a marketing page), so for them "back" is the front page, not a login bounce.
 *
 * Held by `app/onboarding/first-screen-can-cancel.test.ts`.
 */
export const ONBOARDING_EXIT_HREF = '/dashboard/create-event';

export function onboardingExit(authed: boolean): { href: string; label: string } {
  return authed
    ? { href: ONBOARDING_EXIT_HREF, label: 'Cancel — pick a different event' }
    : { href: '/', label: 'Cancel — back to Setnayan' };
}
