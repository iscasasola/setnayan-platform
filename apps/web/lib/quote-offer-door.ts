/**
 * lib/quote-offer-door.ts — 🏷 "APPLY AN OFFER" ON THE QUOTE (owner 11 Nov 2026, asked whether the quote gets the Offer
 * Maker line: *"YES. they can load a bundle also and edit from it."*; approved prototype
 * `controller-2026-11-11/client-supplier-page.html` frame 6 — "a fitting offer beside Discount, never auto-applied" ·
 * "an applied Offer Maker offer shows as its own named line, never folded into a price").
 *
 * NOTHING HERE IS A NEW DISCOUNT RULE. Which offers fit and what each takes off are the Offer Maker's own answers:
 *   · `offerCandidatesFor` (lib/offers.ts) — the ONE projection of a shop's offers onto a card: running, has a % or ₱
 *     part, reaches that card, the early-bird rung, the season window, the last day to book;
 *   · `pickBestDiscount` (lib/vendor-service-public.ts) — the ONE function that prices a candidate for couples
 *     (% first, then ₱ off what is left, never below ₱0; a ₱ amount capped at the price) and drops a season the
 *     event falls outside, a rung the event date does not earn, and an offer past its last day;
 *   · the quote seed's own applying rule (lib/quote-from-service-card.ts step 7): an "up to" rung (no event date) or
 *     a season with no event date is ADVERTISED, never applied — so it is not offered here either.
 *
 * The anchor is what the quote's LINES come to (before travel, crew meal and any discount) — the card price as this
 * quote states it, which is what an offer comes off on a card. PURE: no I/O, no React. 🔒 lib/quote-offer-door.test.ts
 */
import { pickBestDiscount } from './vendor-service-public';
import { offerCandidatesFor, priceWords, type Offer } from './offers';
import type { ProposalLineItem } from './vendor-proposals';

/** One offer the quote can take, with what it takes off THIS quote. */
export type QuoteOfferFit = {
  id: string;
  name: string;
  /** "10% + ₱5,000 off" — the Offer Maker's own words for the price part. */
  words: string;
  /** Pesos off the quote's lines, `pickBestDiscount`'s own `savingsPhp`. */
  offPhp: number;
};

export type QuoteOfferInput = {
  offers: readonly Offer[];
  /** The service cards the quote is built from. None → only the offers that reach All cards fit. */
  cardIds: readonly string[];
  /** What the quote's lines come to, in pesos. */
  anchorPhp: number;
  /** The Manila day (YYYY-MM-DD) — the Offer Maker's "today". */
  today: string;
  /** The couple's event day, when known. */
  eventDate: string | null;
  now: Date;
  /** The offer the card discount already IS (the seed picked it) — not offered twice. */
  alreadyInDiscount?: string | null;
};

/** The shop's offers that fit this quote, most pesos off first. */
export function offersForQuote(input: QuoteOfferInput): QuoteOfferFit[] {
  const anchor = Number.isFinite(input.anchorPhp) ? Math.max(0, input.anchorPhp) : 0;
  if (anchor <= 0) return [];
  // No card picked → an offer must reach All cards; '' is a card id no offer names, so `reaches` asks only that.
  const ids = input.cardIds.length > 0 ? input.cardIds : [''];
  const out: QuoteOfferFit[] = [];
  for (const o of input.offers) {
    if (input.alreadyInDiscount && o.id === input.alreadyInDiscount) continue;
    const candidate = ids.map((id) => offerCandidatesFor([o], id, input.today)[0]).find(Boolean);
    if (!candidate) continue;
    const best = pickBestDiscount([candidate], anchor, { eventDate: input.eventDate, now: input.now });
    if (!best || !(best.savingsPhp > 0)) continue;
    // The seed's applying rule: advertised is not applied.
    if (best.leadTier === 'up-to' || (best.eventWindow && !input.eventDate)) continue;
    out.push({ id: o.id, name: o.name.trim() || 'Your offer', words: priceWords(o), offPhp: best.savingsPhp });
  }
  return out.sort((a, b) => b.offPhp - a.offPhp);
}

/** The applied offer, re-priced against the quote as it stands now — null once it no longer fits. */
export function appliedOfferNow(appliedId: string | null, input: QuoteOfferInput): QuoteOfferFit | null {
  if (!appliedId) return null;
  return offersForQuote(input).find((f) => f.id === appliedId) ?? null;
}

/** The offer's OWN NAMED LINE on the couple's quote (prototype: "never folded into a price"). */
export function offerLineItem(fit: QuoteOfferFit): ProposalLineItem {
  return { label: fit.name, detail: `${fit.words} · offer`, amount_centavos: -Math.round(fit.offPhp * 100) };
}
