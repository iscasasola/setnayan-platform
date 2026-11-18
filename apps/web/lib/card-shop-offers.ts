/**
 * 🏷 THE SHOP'S OFFERS, SEEN FROM ONE CARD (Card Maker part 3 · v36 Decided "Offer": "Several can be loaded; couples see
 * the best one" · "made in the step, with Load and Save. No jump to another screen").
 *
 * Ruling 280d53a9 "Yes, extend it": the shipped Offer Maker (`vendor_offers` + `vendor_offer_cards`, Shop › Makers) stays
 * the one place an offer is MADE. The card only says which offers reach it and moves this one card in or out of an
 * offer's reach. It never types a price: every figure is the supplier's own, already on the offer.
 *
 * Pure (no reads, no writes) so the card and the guard agree on what each line says. The write is the shipped
 * `offerMaker({ op: 'save' | 'switch' })` — no new server action.
 */
import { nameFor, reaches, type Offer } from '@/lib/offers';

/** The offers that reach this card, in the shop's own order. */
export function offersOnCard(offers: readonly Offer[], cardId: string): Offer[] {
  return offers.filter((o) => reaches(o, cardId));
}

/** The offers that do not reach this card yet: the ones "Put an offer on this card" lists. */
export function offersOffCard(offers: readonly Offer[], cardId: string): Offer[] {
  return offers.filter((o) => !reaches(o, cardId));
}

/** "On all your cards" · "Only on this card" · "Also on 1 other card" · "Also on 3 other cards". */
export function otherCardsLine(o: Pick<Offer, 'reachesAll' | 'cards'>, cardId: string): string {
  if (o.reachesAll) return 'On all your cards';
  const others = o.cards.filter((c) => c !== cardId).length;
  if (others === 0) return 'Only on this card';
  return `Also on ${others.toLocaleString('en-US')} other ${others === 1 ? 'card' : 'cards'}`;
}

/** The offer's name as the list reads it: the supplier's own name, else the words its parts make. */
export function offerTitle(o: Offer): string {
  return o.name.trim() || nameFor(o);
}

/** This offer, now reaching this card too. An offer on all cards already does: it is returned unchanged. */
export function withCard(o: Offer, cardId: string): Offer {
  if (o.reachesAll || o.cards.includes(cardId)) return o;
  return { ...o, cards: [...o.cards, cardId] };
}

/**
 * This offer without this card. An offer on all cards becomes one on every OTHER card of the shop (`shopCardIds`).
 * Returns null when taking it off would leave the offer on no card at all — the Offer Maker refuses an offer with no
 * card ("Pick at least one card, or choose All cards."), so the card offers "Switch it off" instead.
 */
export function withoutCard(o: Offer, cardId: string, shopCardIds: readonly string[]): Offer | null {
  const rest = (o.reachesAll ? shopCardIds : o.cards).filter((c) => c !== cardId);
  if (rest.length === 0) return null;
  return { ...o, reachesAll: false, cards: [...new Set(rest)] };
}

/** The Offer Maker, opened with this card picked — the shipped door (`lib/vendor-growth-recs.ts` uses the same one). */
export function newOfferHref(cardId: string): string {
  return `/vendor-dashboard/shop?maker=offers&new=card&card=${encodeURIComponent(cardId)}`;
}
