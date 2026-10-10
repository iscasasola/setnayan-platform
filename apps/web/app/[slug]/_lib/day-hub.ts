/**
 * app/[slug]/_lib/day-hub.ts — WHEN THE DAY'S HUB (`/[slug]/hub`) SPEAKS.
 *
 * `/[slug]/hub` is the day's own screen: its first tab is "Live", its header
 * names the day. Measured on the live page 61 days before an event
 * (2026-10-11): it said "THE DAY" over a lit "Live" tab, while the event's own
 * page — one address up — said "INVITATION". Two pages, two answers to "what
 * stage is this event at", because the hub asked only the calendar window
 * (`getDayOfPhase`) and never the page's stage.
 *
 * 🔑 ONE ANSWER. The stage is the one `app/[slug]/page.tsx` resolves — the
 * couple's pin, else the clock (`manualLaunchPhase(…) ?? getLifecyclePhase(…)`),
 * a host's `?phase=` preview first. The hub page composes exactly that and asks
 * this: while the stage is still BEFORE the day (Save the Date · Invitation),
 * there is no day to show, and `/hub` sends the visitor to the page that speaks
 * for that stage. On The Day and after it (Post Event links back to it as the
 * record of the day) the hub draws.
 *
 * Pure. No second clock, no second rule.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/** Does the day's hub draw at this stage? */
export function dayHubOpens(stage: LifecyclePhase): boolean {
  return stage === 'event' || stage === 'editorial';
}
