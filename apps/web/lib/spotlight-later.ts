/**
 * spotlight-later.ts — ☑ "SHOWS UNTIL TICKED" (owner 12 Nov 2026, the supplier's first-login tour).
 *
 * A tour whose last card carries a tick box (`SpotlightFinale.tick`) is recorded ONLY when the box is ticked. Closing
 * it unticked must not bring it straight back on the next page or the next reload of this visit — only at the next
 * sign-in. So the close is remembered for this browser session (sessionStorage: a new visit starts empty), and the
 * mount asks here before it starts the tour again.
 *
 * Its own tiny file so the client mount can ask without loading the engine (`spotlight-tour.tsx` is lazy) or any
 * tour's words (`lib/tours-stay-on-the-server.test.ts`). Storage refused (private mode, a blocked site) → the tour is
 * simply offered again, which is the safe direction: nobody loses a tour they never ticked.
 */
const LATER = 'setnayan.spotlight.later.';

/** Was this tour closed unticked earlier in this visit? */
export function spotlightLaterThisVisit(tourKey: string): boolean {
  try {
    return window.sessionStorage.getItem(LATER + tourKey) === '1';
  } catch {
    return false;
  }
}

/** Remember that this tour was closed unticked — it waits for the next visit. */
export function markSpotlightLaterThisVisit(tourKey: string): void {
  try {
    window.sessionStorage.setItem(LATER + tourKey, '1');
  } catch {
    /* storage refused — the tour is offered again, never lost */
  }
}
