/**
 * WHAT AN OFFERED-SERVICE CARD MAY STILL OFFER — the sibling of
 * `quote-card-state.ts`, for the other card a supplier can put in a thread.
 *
 * ── THE RULING (owner, 2026-09-22) ──────────────────────────────────────────
 * **The quote card REPLACES the offered-service card in the thread.** A
 * supplier offers a service, then quotes for it; the offer is no longer the
 * live thing and must stop reading as if it were.
 *
 * ── THE MITIGATION, WHICH IS PART OF THE RULING ─────────────────────────────
 * "Replaces" does NOT mean "deletes". Removing the card destroys a view, and
 * "both stay" was the reversible option the owner declined — so the superseded
 * offer stays in the thread as **history**: visible, dimmed, labelled, and
 * carrying no actions. That is the same treatment `quote-card-state.ts` already
 * gives a replaced quote ("Replaced by a newer quote"), and the voice is
 * deliberately borrowed from it so two cards that mean the same thing do not
 * say it two ways.
 *
 * ── WHY A PURE FUNCTION ─────────────────────────────────────────────────────
 * The card lives in a client component with realtime state. A guard that greps
 * its JSX finds *a* dimmed div, not *the* rule. This decision is executed by
 * `offered-service-card-state.test.ts`; the card is only allowed to draw what
 * it is handed.
 *
 * ⛔ Nothing here writes, and nothing here deletes. It decides what to SHOW.
 */

export type OfferedServiceCardInput = {
  /** `chat_messages.created_at` of the message carrying `offered_service_id`. */
  offeredAt: string | null | undefined;
  /**
   * `chat_messages.created_at` of the NEWEST message carrying a `proposal_id`
   * in this thread, or null when the supplier has not quoted yet.
   */
  latestQuoteAt: string | null | undefined;
};

export type OfferedServiceCardState = {
  kind: 'live' | 'superseded';
  /** History note, in the voice `quote-card-state` already uses. Null when live. */
  note: string | null;
  /** May the card still act? A superseded offer is a record, not an offer. */
  actionable: boolean;
};

const LIVE: OfferedServiceCardState = { kind: 'live', note: null, actionable: true };

/** Milliseconds, or null when the value is absent or not a date. */
function ms(value: string | null | undefined): number | null {
  if (value == null) return null;
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? null : t;
}

/**
 * ⚖ **A TIE GOES TO THE QUOTE.** Equal timestamps mean the quote supersedes:
 * the quote is the card that carries money, and of the two possible mistakes —
 * showing a stale offer as live, or marking a live offer as history — only the
 * first can cause someone to act on the wrong number.
 *
 * ⚖ **UNREADABLE DATA LEAVES THE CARD LIVE.** If either timestamp is missing or
 * unparseable we cannot know the order, and the ruling's mitigation is that a
 * view must not be destroyed. An absence is not evidence of a quote; marking a
 * card as replaced on a `null` would retire an offer no quote ever replaced.
 */
export function offeredServiceCardState(
  input: OfferedServiceCardInput,
): OfferedServiceCardState {
  const offered = ms(input.offeredAt);
  const quoted = ms(input.latestQuoteAt);
  if (offered === null || quoted === null) return LIVE;
  if (quoted < offered) return LIVE;
  return { kind: 'superseded', note: 'Replaced by a quote', actionable: false };
}

/**
 * The newest `created_at` among the thread's quote messages, or null.
 * Kept here, beside the rule that consumes it, so the caller cannot invent a
 * second way of deciding which quote is newest.
 */
export function latestQuoteAtFrom(
  messages: ReadonlyArray<{ proposal_id?: string | null; created_at?: string | null }>,
): string | null {
  let bestRaw: string | null = null;
  let bestMs = -Infinity;
  for (const m of messages) {
    if (!m.proposal_id) continue;
    const t = ms(m.created_at);
    if (t === null) continue;
    if (t > bestMs) {
      bestMs = t;
      bestRaw = String(m.created_at);
    }
  }
  return bestRaw;
}
