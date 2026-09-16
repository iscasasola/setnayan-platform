/**
 * The words the couple gets when their shared Papic pot runs out — pure, so a
 * guard can EXECUTE them. `papic-pool-spent-notice.ts` is `server-only` and a
 * test cannot import it, which is exactly how copy ends up unguarded.
 */

/**
 * Once per this window, not once per refused shot. The refusal fires on every
 * subsequent capture attempt and a reception produces hundreds of them; a
 * window (rather than "ever") still tells a couple who top up and run dry again
 * on a second day.
 */
export const POOL_SPENT_NOTICE_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Subject line + tray title. Says what happened, not how it feels. */
export function poolSpentNoticeTitle(): string {
  return 'Your guests have run out of Papic shots';
}

/**
 * ⛔ MUST NAME THE CONSEQUENCE THAT IS HAPPENING RIGHT NOW. A notice that only
 * says "the pot is empty" reads like an accounting line; what is actually
 * happening is that guests holding cameras are being refused, at the
 * celebration, while it is still on.
 */
export function poolSpentNoticeBody(displayName: string): string {
  return (
    `Everyone at ${displayName} shares one set of Papic shots, and they are all spent — ` +
    `guests trying to take a photo right now are being turned away. ` +
    `The shots do not refill on their own. Open Papic to add more.`
  );
}
