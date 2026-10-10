/**
 * lib/quote-answer-notice.ts — WHAT A SUPPLIER IS TOLD WHEN A COUPLE ANSWERS
 * THEIR QUOTE.
 *
 * 🔴 WHY (2026-10-10). `respond_vendor_proposal` recorded the couple's accept or
 * decline and nothing told the supplier — they learned it only by opening the
 * customer card. The notice is emitted from `respondToProposal`
 * (app/vendor-dashboard/proposals/actions.ts); the WORDS live here so
 * `quote-answer-notice.test.ts` can execute them.
 *
 * 🔑 THE YES USES THE CUSTOMER CARD'S OWN SENTENCE, FROM THE SAME FUNCTION.
 * `supplierNextMove` already tells a supplier what an accepted quote means —
 * "The booking locks when they ask and you agree — nothing to do until then."
 * An email that said anything else (above all "you are booked") would state the
 * one thing that has not happened: accepting a quote is not booking it.
 *
 * Pure. No I/O.
 */
import { supplierNextMove, type SupplierNextMoveFacts } from './supplier-next-move';

export type QuoteAnswer = 'accepted' | 'declined';

/** The customer card's state for "a quote is accepted and nothing else has happened". */
const QUOTE_ACCEPTED_FACTS: SupplierNextMoveFacts = {
  inquiryStatus: 'accepted',
  lockRequested: false,
  awaitingPaymentCount: 0,
  isDelivered: false,
  hasReview: false,
  isBooked: false,
  isAccepted: true,
  isQuoted: true,
};

export function isQuoteAnswer(value: string): value is QuoteAnswer {
  return value === 'accepted' || value === 'declined';
}

export function quoteAnswerNotice(args: {
  response: QuoteAnswer;
  /** The event's name, as the supplier already sees it on the customer card. */
  who: string;
  /** `vendor_proposals.title` — which quote, for a shop with several out. */
  quoteTitle: string;
}): { title: string; body: string } {
  const quote = args.quoteTitle.trim().slice(0, 80);
  if (args.response === 'accepted') {
    return {
      title: `${args.who} accepted your quote`,
      body: supplierNextMove(QUOTE_ACCEPTED_FACTS, args.who).body,
    };
  }
  return {
    title: `${args.who} declined your quote`,
    body: quote
      ? `They did not take “${quote}”. You can send another quote from the conversation.`
      : 'They did not take it. You can send another quote from the conversation.',
  };
}
