/**
 * proposal-back.ts — the way OUT of a quote, as one rule.
 *
 * Owner, live on the payment run, 2026-09-20: *"when i click view proposal, it
 * opens the proposal, but when i press back, it doesn't go back."*
 *
 * ── WHAT WAS ACTUALLY BROKEN ────────────────────────────────────────────────
 * Nothing touches the browser's history stack on this hop. Every door into
 * `/proposals/[publicId]` is a plain `<Link>` — no `target`, no new context, no
 * `redirect()` on load — so the browser's own Back button does return to the
 * page you came from.
 *
 * What did not go back is the page's OWN control, the one labelled "Back" in
 * the top-left corner, which is what a person presses. It was hard-coded:
 *
 *     href={isVendorSide || !event_id ? '/vendor-dashboard/proposals'
 *                                     : `/dashboard/${event_id}/vendors`}
 *
 * The couple reached the quote from THE CONVERSATION — the chat card's "View
 * proposal", or the Payments tab the chat links to — and pressing Back put them
 * on the Vendors bench, a different screen entirely. It is not "back" in any
 * sense the person who pressed it meant, and on the one screen where they have
 * just been asked to agree to a price, being moved somewhere else reads as the
 * app losing their place.
 *
 * 🔑 THE DESTINATION IS RESOLVED, NOT REMEMBERED. The obvious fix is a `?from=`
 * on every link, which means finding every call site today and forever (there
 * are five, in four files, plus two server-action redirects) and trusting a
 * caller-supplied path enough to navigate to it. Instead the quote's own thread
 * is looked up where it is read — `chat_threads` on (event_id,
 * vendor_profile_id), the same pair the workspace uses for its chat deep-link.
 * That makes Back correct for an arrival this repo does not control either: an
 * emailed link, a bookmark, a refresh, a vendor opening the couple's copy.
 *
 * ⚖ A FALLBACK, NEVER A DEAD END. No thread (or a refused read) keeps exactly
 * the destination this page had before, so the control can never vanish and
 * can never point at nothing.
 */

export type ProposalBackDoor = {
  /** Where the control goes. Always an in-app absolute path. */
  href: string;
  /** What the control says — it names WHERE it goes, never just "Back". */
  label: string;
};

/**
 * The label a thread-aware Back must carry. Exported so the page and its guard
 * cannot disagree about the words the owner actually asked for.
 */
export const BACK_TO_CONVERSATION = 'Back to the conversation';

export function proposalBackDoor(input: {
  /** Is the reader the supplier's org (rather than the couple/delegate)? */
  isVendorSide: boolean;
  /** `vendor_proposals.event_id` — NULL once the couple deleted the celebration. */
  eventId: string | null | undefined;
  /** `chat_threads.thread_id` for this (event, supplier), or null. */
  threadId: string | null | undefined;
}): ProposalBackDoor {
  const { isVendorSide, eventId, threadId } = input;

  if (threadId) {
    // Two routes, one conversation: the supplier's thread page and the
    // couple's. The couple's carries the event in its path, so it needs one —
    // without it there is no route to build and the fallback below is right.
    if (isVendorSide) {
      return { href: `/vendor-dashboard/messages/${threadId}`, label: BACK_TO_CONVERSATION };
    }
    if (eventId) {
      return {
        href: `/dashboard/${eventId}/messages/${threadId}`,
        label: BACK_TO_CONVERSATION,
      };
    }
  }

  /* The pre-existing destinations, unchanged. `event_id` is NULL once the
     couple has deleted the celebration (slice 5 of "vendors get to keep it");
     interpolating it blind produces `/dashboard/null/vendors`. */
  if (isVendorSide || !eventId) {
    return { href: '/vendor-dashboard/proposals', label: 'Back to your quotes' };
  }
  return { href: `/dashboard/${eventId}/vendors`, label: 'Back to your suppliers' };
}
