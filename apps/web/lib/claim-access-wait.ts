/**
 * 🔗 A SUPPLIER WHO JOINED FROM A COUPLE'S LINK IS TOLD THE COUPLE MUST APPROVE — AND WHEN THEY DO
 * (supplier gate audit G3, 2026-11-02; owner "THE MINIMUM TO LET SUPPLIERS IN" — "Onboarding via QR/link created by a
 * user … lands linked to that event").
 *
 * The claim raises ONE pending ask (`claim_ask_for_access`); the couple's Approve runs the link. Until this file the
 * supplier landed on Today with nothing about it, and nobody told them the answer. Now:
 *   · Today shows "Waiting for <event> to let you in" for every pending claim ask of theirs
 *     (`readClaimWaits`, `claim-access-wait.server.ts`);
 *   · the couple's answer sends them one in-app notice (`claimAnswerNotice`, type `claim_access_answered`, no email).
 */

export type ClaimWait = { requestId: string; eventId: string; eventName: string | null; askedAt: string | null };

/** What Today draws: the waits, or a read that failed (said, never drawn as "nothing waiting"). */
export type ClaimWaitsRead = { ok: true; waits: ClaimWait[] } | { ok: false };

const nameOr = (eventName: string | null | undefined) => (eventName ?? '').trim() || 'the couple';

/** The heading of one wait on Today. */
export function claimWaitTitle(w: Pick<ClaimWait, 'eventName'>): string {
  return `Waiting for ${nameOr(w.eventName)} to let you in`;
}

/** The one line under it. */
export const CLAIM_WAIT_LINE =
  'You joined from their link. They approve you in their Setnayan, and you get a notice here the moment they answer. Their event opens to you then.';

/** Said instead of the waits when they could not be read — never an empty list. */
export const CLAIM_WAIT_UNREADABLE =
  'We could not check whether a couple still has to let you in. Refresh to try again.';

/** The notice the supplier gets when the couple answers. */
export function claimAnswerNotice(args: {
  approved: boolean;
  eventId: string;
  eventName: string | null;
}): { title: string; body: string; relatedUrl: string } {
  const who = (args.eventName ?? '').trim() || 'The couple';
  return args.approved
    ? {
        title: `${who} let you in`,
        body: 'You are on their event now. Open it to see your day.',
        relatedUrl: `/vendor-dashboard/clients/${args.eventId}`,
      }
    : {
        title: `${who} did not let you in`,
        body: 'They declined the link you joined from. If that was a mistake, ask them to send it again.',
        relatedUrl: '/vendor-dashboard',
      };
}
