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
 *     event falls outside, a rung the event date does not earn, and an offer past its last day — the 9 Nov rule the
 *     owner KEPT on 12 Nov ("QUOTE MONEY — THREE ANSWERS" (1));
 *   · the quote seed's own applying rule (lib/quote-from-service-card.ts step 7): an "up to" rung (no event date) or
 *     a season with no event date is ADVERTISED, never applied — so it is not offered here either.
 *
 * 🎯 THE ANCHOR IS THE OFFER'S OWN CARDS (owner 12 Nov, "Three quote rulings" (2)): *an offer that reaches one service
 * card comes off THAT CARD'S lines only, shown "on <card> only"*. Every quote line carries the card it came from
 * (`cardId`); an offer's anchor is the sum of the lines whose card it `reaches` — an All-cards offer reaches the whole
 * quote. Travel, crew meal and any typed discount are never in it; the typed discount comes off AFTER the offer
 * (lib/quote-money.ts).
 *
 * 🧩 EVERY PART COUNTS (approved design, 12 Nov): an offer whose only part is a lower first payment or a gift is
 * offered too — it takes nothing off the price, so `offPhp` is 0 and its `firstPayment` / `gifts` say what it gives.
 * PURE: no I/O, no React. 🔒 lib/quote-offer-door.test.ts
 */
import { pickBestDiscount } from './vendor-service-public';
import {
  firstPaymentWords,
  giftKey,
  giftsOn,
  hasFirstPayment,
  hasPrice,
  offerCandidatesFor,
  priceWords,
  reaches,
  type Offer,
  type OfferGift,
} from './offers';
import type { ProposalLineItem } from './vendor-proposals';

/** One line of the quote as an offer sees it: the card it came from (null = typed, catalogue) and what it comes to. */
export type QuoteOfferLine = { cardId: string | null; amountPhp: number };

/** One offer the quote can take, with what it takes off THIS quote. */
export type QuoteOfferFit = {
  id: string;
  name: string;
  /** "10% + ₱5,000 off" — the Offer Maker's own words for the price part ('' when it has none). */
  words: string;
  /** Pesos off the lines it reaches, `pickBestDiscount`'s own `savingsPhp` (0 = no price part). */
  offPhp: number;
  /** True = All cards: it reaches the whole quote. */
  reachesAll: boolean;
  /** The quote's cards it reaches (empty when `reachesAll`). */
  reachIds: string[];
  /** Its lower first payment, when it has one — the plan's first row follows it. */
  firstPayment: { unit: 'php' | 'pct'; value: number; words: string } | null;
  /** The gifts it gives on the cards it reaches, each once. */
  gifts: OfferGift[];
};

export type QuoteOfferInput = {
  offers: readonly Offer[];
  /** The quote's lines, each with its card. No lines → nothing fits. */
  lines: readonly QuoteOfferLine[];
  /** The Manila day (YYYY-MM-DD) — the Offer Maker's "today". */
  today: string;
  /** The couple's event day, when known. */
  eventDate: string | null;
  now: Date;
  /** The offer the card discount already IS (the seed picked it) — not offered twice. */
  alreadyInDiscount?: string | null;
};

const peso = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** The lines an offer reaches: its own cards' lines, or every line for an All-cards offer. */
export function reachedLines(o: Pick<Offer, 'reachesAll' | 'cards'>, lines: readonly QuoteOfferLine[]): QuoteOfferLine[] {
  return o.reachesAll ? [...lines] : lines.filter((l) => l.cardId != null && reaches(o, l.cardId));
}

/** What an offer comes off — the sum of ONLY the lines it reaches (owner 12 Nov). */
export function offerAnchorPhp(o: Pick<Offer, 'reachesAll' | 'cards'>, lines: readonly QuoteOfferLine[]): number {
  return reachedLines(o, lines).reduce((s, l) => s + peso(l.amountPhp), 0);
}

/**
 * May THIS couple have the offer at all (its who-rule: running, a season the event is in, an early-bird rung the
 * date earns)? The question is asked of the ONE rule — the offer's own candidate through `pickBestDiscount` — so an
 * offer with no price part is probed with a 1% stand-in price part, never judged by a second copy of the rule.
 */
function whoAllows(o: Offer, cardId: string, input: QuoteOfferInput): boolean {
  const probe = offerCandidatesFor([{ ...o, pctOff: 1, phpOff: null }], cardId, input.today)[0];
  if (!probe) return false;
  const best = pickBestDiscount([probe], 100, { eventDate: input.eventDate, now: input.now });
  return Boolean(best && best.savingsPhp > 0 && best.leadTier !== 'up-to' && !(best.eventWindow && !input.eventDate));
}

/** The shop's offers that fit this quote, most pesos off first. */
export function offersForQuote(input: QuoteOfferInput): QuoteOfferFit[] {
  const out: QuoteOfferFit[] = [];
  for (const o of input.offers) {
    if (input.alreadyInDiscount && o.id === input.alreadyInDiscount) continue;
    const lines = reachedLines(o, input.lines);
    if (lines.length === 0) continue;
    // A card id the offer reaches ('' asks only All cards — no offer names it).
    const probeCard = o.reachesAll ? '' : (lines[0]!.cardId as string);
    let offPhp = 0;
    if (hasPrice(o)) {
      const anchor = offerAnchorPhp(o, input.lines);
      const candidate = offerCandidatesFor([o], probeCard, input.today)[0];
      if (!candidate || anchor <= 0) continue;
      const best = pickBestDiscount([candidate], anchor, { eventDate: input.eventDate, now: input.now });
      if (!best || !(best.savingsPhp > 0)) continue;
      // The seed's applying rule: advertised is not applied.
      if (best.leadTier === 'up-to' || (best.eventWindow && !input.eventDate)) continue;
      offPhp = best.savingsPhp;
    } else if (!whoAllows(o, probeCard, input)) {
      continue;
    }
    const reachIds = o.reachesAll ? [] : [...new Set(lines.map((l) => l.cardId as string))];
    const seen = new Set<string>();
    const gifts: OfferGift[] = [];
    for (const id of o.reachesAll ? [''] : reachIds) {
      for (const g of giftsOn(o, id)) {
        if (seen.has(giftKey(g))) continue;
        seen.add(giftKey(g));
        gifts.push(g);
      }
    }
    const firstPayment = hasFirstPayment(o)
      ? { unit: o.firstPaymentUnit, value: o.firstPayment as number, words: firstPaymentWords(o) }
      : null;
    if (offPhp <= 0 && !firstPayment && gifts.length === 0) continue;
    out.push({
      id: o.id,
      name: o.name.trim() || 'Your offer',
      words: hasPrice(o) ? priceWords(o) : '',
      offPhp,
      reachesAll: o.reachesAll,
      reachIds,
      firstPayment,
      gifts,
    });
  }
  return out.sort((a, b) => b.offPhp - a.offPhp);
}

/** The applied offer, re-priced against the quote as it stands now — null once it no longer fits. */
export function appliedOfferNow(appliedId: string | null, input: QuoteOfferInput): QuoteOfferFit | null {
  if (!appliedId) return null;
  return offersForQuote(input).find((f) => f.id === appliedId) ?? null;
}

/** "on Garden buffet only" — the reach caption; null for an All-cards offer (it is the whole quote). */
export function reachWords(fit: Pick<QuoteOfferFit, 'reachesAll' | 'reachIds'>, nameOf: (cardId: string) => string): string | null {
  if (fit.reachesAll || fit.reachIds.length === 0) return null;
  return `on ${fit.reachIds.map(nameOf).join(' + ')} only`;
}

/** Every word an offer's parts say ("5% off · ₱5,000 to reserve · a gift"). */
export function partsWords(fit: Pick<QuoteOfferFit, 'words' | 'firstPayment' | 'gifts'>): string {
  return [fit.words, fit.firstPayment?.words ?? '', fit.gifts.length > 0 ? (fit.gifts.length === 1 ? 'a gift' : `${fit.gifts.length} gifts`) : '']
    .filter(Boolean)
    .join(' · ');
}

/**
 * The offer's OWN NAMED LINE on the couple's quote (prototype: "never folded into a price") — with its reach and its
 * id, so a revision of this quote keeps the line's offer (owner 12 Nov: *"once the client has added a service at that
 * price, that service's discount stays with it"*). Null when it takes nothing off the price.
 */
export function offerLineItem(fit: QuoteOfferFit, reach: string | null = null): ProposalLineItem | null {
  if (!(fit.offPhp > 0)) return null;
  return {
    label: fit.name,
    detail: [fit.words, reach, 'offer'].filter(Boolean).join(' · '),
    amount_centavos: -Math.round(fit.offPhp * 100),
    offer_id: fit.id,
  };
}
