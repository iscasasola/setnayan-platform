/**
 * THE SUPPLIER'S NEXT MOVE, DECIDED ONCE AND EXECUTABLE.
 *
 * ── WHY THIS FILE EXISTS (owner, 2026-09-18) ────────────────────────────────
 * The client page's "Your next move" tile read **"Quote sent — follow up while
 * you wait"** to a supplier whose couple had already accepted the quote AND
 * asked to book — the one state with a 48-hour fuse on it, and the one the
 * supplier actually had to act on. Beside it the pipeline strip still said
 * **"Quoted"**. Both were derived inline in the page from a chain that knew
 * about pending inquiries, payments, delivery and booking, and had never been
 * told that a quote can be accepted, or that a couple can ask.
 *
 * The chain now lives here, as a pure function over the facts the page already
 * holds, so `lib/supplier-next-move.test.ts` can EXECUTE every rung instead of
 * grepping the page for a sentence. Order, top to bottom — each rung is the
 * thing the supplier must do before anything below it matters:
 *
 *   1. a pending inquiry          → accept or decline
 *   2. a couple's request to book → agree or decline, before the fuse
 *   3. payments awaiting confirm  → confirm receipt
 *   4. delivered                  → wait for / read the confirmation
 *   5. booked                     → run the day
 *   6. quote accepted             → waiting for them to ask to book
 *   7. quote sent                 → follow up
 *   8. nothing yet                → send a quote
 *
 * ⚖ Rung 2 sits ABOVE payments deliberately: a request expires, a payment
 * waits. And it sits below a pending inquiry because a request to book cannot
 * exist on a thread the supplier has not accepted.
 */

export type SupplierNextMoveFacts = {
  /** `chat_threads.inquiry_status` for this event's thread, if any. */
  inquiryStatus: string | null;
  /** The couple has asked this supplier to lock, and nobody has answered. */
  lockRequested: boolean;
  /** Couple-logged payments still waiting on the supplier. */
  awaitingPaymentCount: number;
  isDelivered: boolean;
  hasReview: boolean;
  isBooked: boolean;
  /** A proposal for (this shop × this event) is ACCEPTED. */
  isAccepted: boolean;
  /** A proposal is out (any status but draft). */
  isQuoted: boolean;
};

export type SupplierNextMove = {
  title: string;
  body: string;
};

export function supplierNextMove(
  facts: SupplierNextMoveFacts,
  eventName: string,
): SupplierNextMove {
  if (facts.inquiryStatus === 'pending') {
    return {
      title: 'Respond to the inquiry',
      body: `${eventName} reached out. Accept to open the chat, or decline if you’re not available.`,
    };
  }
  if (facts.lockRequested) {
    return {
      title: 'Answer their request to book',
      body: `${eventName} accepted your quote and asked to lock you in. Agree or decline above — the request expires on its own if nobody answers.`,
    };
  }
  if (facts.awaitingPaymentCount > 0) {
    const n = facts.awaitingPaymentCount;
    return {
      title: `Confirm ${n} payment${n === 1 ? '' : 's'}`,
      body: `${eventName} logged ${n === 1 ? 'a payment' : 'payments'} — confirm receipt to keep the plan on track.`,
    };
  }
  if (facts.isDelivered) {
    return facts.hasReview
      ? { title: 'All wrapped up', body: `${eventName} confirmed delivery and left a review.` }
      : {
          title: 'Awaiting confirmation',
          body: `You marked this delivered. ${eventName} confirms receipt (auto-confirms after 7 days).`,
        };
  }
  if (facts.isBooked) {
    return {
      title: 'You’re booked',
      body: 'Coordinate the run-of-show and post deliverables as the day nears.',
    };
  }
  if (facts.isAccepted) {
    return {
      title: 'Quote accepted',
      body: `${eventName} accepted your quote. The booking locks when they ask and you agree — nothing to do until then.`,
    };
  }
  if (facts.isQuoted) {
    return {
      title: 'Quote sent',
      body: `Your quote is with ${eventName}. Follow up in chat while you wait.`,
    };
  }
  return {
    title: 'Send a quote',
    body: `${eventName} is waiting. Reply in chat, then send a quote.`,
  };
}

/**
 * What the pipeline strip's CURRENT rung says. The rung itself does not move
 * — Inquiry → Quoted → Booked is still the ladder, and a booking exists only
 * once the supplier agrees — but "Quoted" is not the truth about a quote the
 * couple has accepted, and it is a worse untruth once they have asked to book.
 * Null means "the fixed label is right".
 */
export function pipelineCurrentLabel(facts: {
  isBooked: boolean;
  lockRequested: boolean;
  isAccepted: boolean;
}): string | null {
  if (facts.isBooked) return null;
  if (facts.lockRequested) return 'Asked to book';
  if (facts.isAccepted) return 'Quote accepted';
  return null;
}
