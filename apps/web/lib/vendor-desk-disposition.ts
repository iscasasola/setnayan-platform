/**
 * vendor-desk-disposition.ts — does this card ASK the supplier something, or is
 * it just news?
 *
 * ─── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────
 * `vendor-overview.ts` builds the feed and talks to Supabase. The RULE that
 * decides what belongs on an answer list is the part that can be got wrong,
 * and a guard cannot execute it from in there without dragging a server client
 * into a unit test. So the rule lives here, pure, and
 * `the-desk-answers-and-the-news-does-not.test.ts` RUNS it rather than
 * grepping for it.
 *
 * ─── WHAT THIS IS FOR ────────────────────────────────────────────────────
 * The owner's drawing, approved 2026-08-26 ("yes i agree",
 * `prototypes/vendor_dashboard_rearranged_2026-08-26.html`):
 *
 *     the block is called **What's new**, a news name on a to-do list: it mixes
 *     five things waiting on you with a 5-star review that needs nothing.
 *
 * Three of the eleven card kinds carry NO control at all — they are closed
 * lines that hold their place so the supplier can see what happened:
 *
 *   · `lock_request_lapsed` — the booking window shut. Its own docblock in
 *     `vendor-overview.ts` says it "carries no buttons at all".
 *   · `meeting` with `passed: true` — the proposed time has been and gone.
 *     Its docblock: "a closed line, no buttons".
 *   · `dispute` — a link into the case, and deliberately no fast answer. It is
 *     on the NEWS side because the desk must not imply a dispute is a thing
 *     you clear in one tap.
 *
 * Everything else renders at least one control, so everything else is an ask.
 *
 * ⚠ A REVIEW IS AN ASK, INCLUDING A FIVE-STAR ONE. The drawing puts "5 stars
 * from the Santos wedding" under *Good news · nothing to answer*, but the
 * shipped card carries a reply box on every rating, so a five-star review IS
 * answerable and moving it would take the reply box away from the supplier.
 * Splitting reviews by rating or by whether they carry text is a product rule
 * nobody has written down; it is flagged for the owner rather than invented
 * here. See the changelog fragment.
 *
 * 🔑 THE SWITCH IS EXHAUSTIVE ON PURPOSE. Adding a twelfth kind to
 * `WhatsNewCard` without giving it a disposition is a TYPECHECK failure, not a
 * card that silently sorts itself to the top of the answer list. That is the
 * same trick `cardTimestamp` in `vendor-overview.ts` already uses, and its own
 * comment says it is "how this line got written".
 */

import type { WhatsNewCard } from './vendor-overview';

/** An ask the supplier owes somebody, or a closed line they may want to see. */
export type DeskDisposition = 'answer' | 'news';

export function deskDisposition(card: WhatsNewCard): DeskDisposition {
  switch (card.kind) {
    case 'inquiry':
    case 'lock_request':
    case 'delete_request':
    case 'lock':
    case 'review':
    case 'message':
    case 'quote_draft':
    case 'contract_draft':
    // CTRL-B2 build 1. The celebration is over and nobody has said the service
    // was delivered. It carries a control ("I delivered this service"), so by
    // this module's own rule it is an ASK — and it is the ask that unlocks the
    // couple's confirm, their review, and the shop's first track record.
    case 'mark_complete':
      return 'answer';
    // The window shut. Nothing to press; it stays visible for a week so the
    // supplier can see the booking they let go.
    case 'lock_request_lapsed':
      return 'news';
    // A live proposal is an ask; one whose time has passed is a record of it.
    case 'meeting':
      return card.passed ? 'news' : 'answer';
    // A case, not a question. It carries a link and no fast answer, and putting
    // it on the answer list would say a dispute is something you clear.
    case 'dispute':
      return 'news';
  }
}

/**
 * The feed, cut in two, each half keeping the order it arrived in.
 *
 * ⚠ IT DOES NOT SORT. `fetchVendorOverviewData` already orders the whole feed
 * oldest-waiting-first (`cardTimestamp`), and re-sorting here would be a second
 * answer to a question that already has one — the failure mode where two
 * mechanisms disagree and each passes its own test.
 */
export function splitDesk(cards: readonly WhatsNewCard[]): {
  answer: WhatsNewCard[];
  news: WhatsNewCard[];
} {
  const answer: WhatsNewCard[] = [];
  const news: WhatsNewCard[] = [];
  for (const card of cards) {
    (deskDisposition(card) === 'answer' ? answer : news).push(card);
  }
  return { answer, news };
}

/**
 * How long the longest-waiting ASK has waited, in whole days — the second half
 * of the heading the drawing asks for ("5 waiting, oldest 4 days").
 *
 * `null` when nothing is waiting, which must render as NOTHING rather than as
 * "oldest 0 days": a desk with no asks has no oldest one, and printing a zero
 * would be a measurement of an empty set.
 *
 * ⚠ IT READS THE FIRST ELEMENT, because the list arrives oldest-first. If that
 * order ever changes this returns the wrong number, so the guard beside this
 * file asserts the pairing rather than trusting it.
 */
export function oldestAskWaitDays(
  asks: readonly WhatsNewCard[],
  waitedAt: (card: WhatsNewCard) => Date,
  now: Date,
): number | null {
  if (asks.length === 0) return null;
  let oldestMs = Infinity;
  for (const card of asks) {
    const t = waitedAt(card).getTime();
    if (Number.isFinite(t) && t < oldestMs) oldestMs = t;
  }
  if (!Number.isFinite(oldestMs)) return null;
  const days = Math.floor((now.getTime() - oldestMs) / 86_400_000);
  return days > 0 ? days : 0;
}

/**
 * The one status line under the heading. Kept here, beside the rule, so the
 * page cannot grow a second phrasing of the same fact.
 *
 * "3 waiting · oldest 4 days" · "1 waiting · today" · "" when nothing waits
 * (the empty state says it better, and two voices on one subject is the thing
 * this whole change exists to stop).
 */
export function deskStatusLine(count: number, oldestDays: number | null): string {
  if (count <= 0) return '';
  const waiting = `${count} waiting`;
  if (oldestDays === null) return waiting;
  if (oldestDays <= 0) return `${waiting} · oldest today`;
  return `${waiting} · oldest ${oldestDays} ${oldestDays === 1 ? 'day' : 'days'}`;
}
