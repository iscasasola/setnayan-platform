/**
 * lib/offers.ts — 🏷 THE OFFER MAKER'S RULES, IN ONE PLACE (Build 6 · Lane D).
 *
 * Owner, 9 Nov 2026: *"Offer maker"* · *"We want to mix them all"* · *"% and pesos discount can work together"* ·
 * *"Starts with % first then remaining is pesos off"* · *"Each supplier has their own collection of gifts"*; 10 Nov:
 * *"service cards can receive multiple offer templates. but only the best offer will show"* + "all yes" (below);
 * 11 Nov: *"our offer maker already solves this"* (the off-season offer = Who gets it → Event date in a season).
 * Approved prototype: Setnayan-specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/discount-maker.html`
 * (artifact 1fdSN1HRkYWm1nfbpYRteh) — its `data.js` is the rule book this file ports, function for function.
 *
 * ✅ SETTLED 10 Nov ("all yes", DECISION_LOG) — each one is held by `lib/offers.test.ts`:
 *   · the supplier's OWN gifts (add-ons, typed gifts) have NO 40% limit — the limit binds Setnayan gifts only (`limitApplies`);
 *   · 📦 ONE PRICE PER GIFT (14 Nov, superseding the 10 Nov stocked gift price): every Setnayan gift is at its list
 *     price, stocked or on the booking fee; stock only says whether it is already paid for. The only discount is the
 *     buy-10-get-1 Papic bundle, which fills the stock (lib/shop-gifts.ts);
 *   · offers never stack — the single best price result wins (`pickBestDiscount`, the ONE function, reads
 *     `offerCandidatesFor`); the lowest first payment wins (`bestFirstPayment`);
 *   · the same gift from two offers is given ONCE (`giftsFor`).
 *   (· a near-match bundle is a suggestion only — that is the Bundle Maker's quote rule, not an offer rule.)
 *
 * ⏳ STILL OPEN (do not build — owner asked in the 9 Nov brief, not yet answered): "spreading expected bookings"
 *   (how a stocked gift's expected uses are spread across the cards of a Pick-per-card offer). `stockLine` says what is
 *   in stock and what each costs, and never forecasts uses. TODO(owner): spreading expected bookings.
 *
 * 💰 NO NUMBER HERE GOVERNS MONEY. The gift limit is the admin's live `gift_limit_pct` of the live booking fee
 * (`giftLimitCentavos`, lib/shop-gifts.ts); the gift prices are `platform_retail_catalog_v2` rows. The only figures in
 * this file are the supplier's own (their %, their ₱, their first payment).
 *
 * PURE: no I/O. 🔒 lib/offers.test.ts
 */
import type { BookingFeeSchedule } from './booking-fee';
import { formatPhpRounded } from './php';
import {
  alwaysAllowedPack,
  freeOfPack,
  giftLimitCentavos,
  type FreeByKind,
  type ShopGiftPack,
} from './shop-gifts';
import type { DiscountType, VendorServiceDiscount } from './vendor-services';

// ── The shape ────────────────────────────────────────────────────────────────

/** 4 · Who gets it? The answer's own field sits under the question. */
export const OFFER_WHO = ['everyone', 'early_bird', 'first_n', 'season', 'returning'] as const;
export type OfferWho = (typeof OFFER_WHO)[number];

export const WHO_LABEL: Readonly<Record<OfferWho, string>> = {
  everyone: 'Everyone',
  early_bird: 'Early bird',
  first_n: 'The first N couples',
  season: 'Event date in a season',
  returning: 'Couples who booked you before',
};

/** The line under each choice in the Who dropdown (the prototype's DTYPES[*].line). */
export const WHO_SUB: Readonly<Record<OfferWho, string>> = {
  everyone: 'Every couple who books the cards it reaches',
  early_bird: 'Books at least N months before the event · 12 = a year',
  first_n: 'The first couples who book · turns itself off at 0',
  season: 'The EVENT falls inside a from–to window',
  returning: 'On their next event with you',
};

/** A gift on an offer: one of the shop's add-ons given free · a Setnayan gift · a typed one-off. `card` only in Pick per card. */
export type OfferGift =
  | { kind: 'addon'; addonId: number; card?: string }
  | { kind: 'sn'; code: string; card?: string }
  | { kind: 'typed'; label: string; worthPhp: number | null; card?: string };

export type Offer = {
  /** `vendor_offers.public_id`. */
  id: string;
  name: string;
  /** 2 · Which cards? true = All cards. */
  reachesAll: boolean;
  /** The cards picked (vendor_service_id), when not All cards. */
  cards: string[];
  /** 3 · What do they get? */
  pctOff: number | null;
  phpOff: number | null;
  firstPayment: number | null;
  firstPaymentUnit: 'php' | 'pct';
  giftMode: 'same' | 'per';
  gifts: OfferGift[];
  /** 4 · Who gets it? */
  who: OfferWho;
  minLeadMonths: number | null;
  firstNCap: number | null;
  firstNTaken: number;
  seasonFrom: string | null;
  seasonTo: string | null;
  /** 5 · How long? The last day a couple can book with it (YYYY-MM-DD); null = until switched off. */
  untilDate: string | null;
  isOn: boolean;
  sortOrder: number;
};

/** A card the offer can reach, as the maker draws it. */
export type OfferCard = {
  id: string;
  name: string;
  /** The "from ₱X" couples read — the anchor every % is taken from. null = no price yet. */
  pricePhp: number | null;
  /** "Mobile Bar · Booths, carts & bars". */
  leaf?: string | null;
  coverUrl?: string | null;
  isActive?: boolean;
  /** The card's own `vendor_service_discounts` rows — they compete with the offers in `pickBestDiscount`. */
  discounts?: VendorServiceDiscount[];
};

/** One of the shop's add-ons — the supplier's own gift collection (vendor_service_addons). */
export type ShopAddon = { id: number; cardId: string; label: string; fromPhp: number | null };

/** The live numbers a gift is judged with — read on the server, never typed (lib/shop-gifts.ts). */
export type GiftContext = {
  packs: readonly ShopGiftPack[];
  schedule: BookingFeeSchedule;
  limitPct: number;
  /** Free to offer, per kind (Papic per pack); null = could not be read (said so, never "0 in stock"). */
  free: FreeByKind | null;
  addons: readonly ShopAddon[];
};

// ── 3 · What do they get? — the four parts ────────────────────────────────────

export const hasPct = (o: Pick<Offer, 'pctOff'>) => (o.pctOff ?? 0) > 0;
export const hasPhp = (o: Pick<Offer, 'phpOff'>) => (o.phpOff ?? 0) > 0;
export const hasPrice = (o: Pick<Offer, 'pctOff' | 'phpOff'>) => hasPct(o) || hasPhp(o);
export const hasFirstPayment = (o: Pick<Offer, 'firstPayment'>) => (o.firstPayment ?? 0) > 0;
export const hasGift = (o: Pick<Offer, 'gifts'>) => o.gifts.length > 0;

export type OfferPart = 'pct' | 'php' | 'down' | 'gift';
export const OFFER_PARTS: readonly OfferPart[] = ['pct', 'php', 'down', 'gift'];
export const PART_LABEL: Readonly<Record<OfferPart, { label: string; sub: string }>> = {
  pct: { label: '% off', sub: 'A share off the card price · first' },
  php: { label: '₱ off', sub: 'Pesos off what’s left after the %' },
  down: { label: 'Lower first payment', sub: 'Same price · less to reserve' },
  gift: { label: 'A gift', sub: 'Your extras · Setnayan gifts · fits card by card' },
};

export function partsOf(o: Offer): OfferPart[] {
  return OFFER_PARTS.filter((k) => (k === 'pct' ? hasPct(o) : k === 'php' ? hasPhp(o) : k === 'down' ? hasFirstPayment(o) : hasGift(o)));
}

/**
 * INSIDE one offer: the % comes off the card price first, then the ₱ off what remains; never below ₱0 (owner 9 Nov).
 * ₱110,000 · 10% → ₱99,000 · −₱5,000 → ₱94,000. The steps are what the worked line shows.
 */
export function priceSteps(o: Pick<Offer, 'pctOff' | 'phpOff'>, price: number): number[] {
  const s = [price];
  let p = price;
  if (hasPct(o)) {
    p = Math.max(0, p - Math.round((p * (o.pctOff as number)) / 100));
    s.push(p);
  }
  if (hasPhp(o)) {
    p = Math.max(0, p - (o.phpOff as number));
    s.push(p);
  }
  return s;
}

/** What this offer takes off a card of `price`, in pesos. */
export function offAmount(o: Pick<Offer, 'pctOff' | 'phpOff'>, price: number): number {
  const s = priceSteps(o, price);
  return price - s[s.length - 1]!;
}

/** "₱110,000 → ₱99,000 → ₱94,000". */
export function workedLine(o: Pick<Offer, 'pctOff' | 'phpOff'>, price: number): string {
  return priceSteps(o, price).map(php).join(' → ');
}

/** The first payment this offer asks on a card couples pay `pay` for (the price never changes). */
export function firstPaymentOf(o: Pick<Offer, 'firstPayment' | 'firstPaymentUnit'>, pay: number): number {
  const v = o.firstPayment ?? 0;
  return o.firstPaymentUnit === 'pct' ? Math.round((pay * v) / 100) : Math.min(v, pay);
}

// ── Reach, status and words ───────────────────────────────────────────────────

export const reaches = (o: Pick<Offer, 'reachesAll' | 'cards'>, cardId: string) => o.reachesAll || o.cards.includes(cardId);

export type OfferStatus = { k: 'run' | 'off' | 'ended' | 'taken'; label: string };

/** One honest chip, read from the row itself (the prototype's statusOf). `today` is the Manila day (YYYY-MM-DD). */
export function offerStatus(o: Offer, today: string): OfferStatus {
  if (o.who === 'first_n' && o.firstNCap != null && o.firstNTaken >= o.firstNCap) return { k: 'taken', label: `All ${count(o.firstNCap)} taken` };
  if (o.untilDate && o.untilDate < today) return { k: 'ended', label: 'Ended' };
  if (!o.isOn) return { k: 'off', label: 'Off' };
  return { k: 'run', label: 'Running' };
}

export const isRunning = (o: Offer, today: string) => offerStatus(o, today).k === 'run';

/** ONE list: Running first, then Off, then Ended / taken; the supplier's own order inside each. */
export function sortOffers(list: readonly Offer[], today: string): Offer[] {
  const rank = (o: Offer) => ({ run: 0, off: 1, ended: 2, taken: 2 })[offerStatus(o, today).k];
  return list
    .map((o, i) => ({ o, i }))
    .sort((a, b) => rank(a.o) - rank(b.o) || a.o.sortOrder - b.o.sortOrder || a.i - b.i)
    .map((x) => x.o);
}

const php = (n: number) => formatPhpRounded(n);
const count = (n: number) => n.toLocaleString('en-PH');
const nWord = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;
const pctWord = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}%`;

/** "10% + ₱5,000 off" · "" when it takes nothing off the price. */
export function priceWords(o: Pick<Offer, 'pctOff' | 'phpOff'>): string {
  if (!hasPrice(o)) return '';
  return `${[hasPct(o) ? pctWord(o.pctOff as number) : '', hasPhp(o) ? php(o.phpOff as number) : ''].filter(Boolean).join(' + ')} off`;
}

/** "₱5,000 to reserve" · "First payment 10%". */
export function firstPaymentWords(o: Pick<Offer, 'firstPayment' | 'firstPaymentUnit'>): string {
  if (!hasFirstPayment(o)) return '';
  return o.firstPaymentUnit === 'pct' ? `First payment ${pctWord(o.firstPayment as number)}` : `${php(o.firstPayment as number)} to reserve`;
}

/** "Jun 1 – Aug 31, 2027". */
export function seasonWords(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const md = { month: 'short', day: 'numeric' } as const;
  return `${f.toLocaleDateString('en-PH', md)} – ${t.toLocaleDateString('en-PH', { ...md, year: 'numeric' })}`;
}

export function shortDate(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Who, in a few words: "Everyone" · "Booked a year+ ahead" · "First 5 couples · 3 left" · "Jun 1 – Aug 31, 2027". */
export function whoLine(o: Offer): string {
  if (o.who === 'first_n' && o.firstNCap != null) {
    const left = Math.max(0, o.firstNCap - o.firstNTaken);
    return left > 0 ? `First ${count(o.firstNCap)} couples · ${count(left)} left` : `All ${count(o.firstNCap)} taken`;
  }
  if (o.who === 'season' && o.seasonFrom && o.seasonTo) return `Events ${seasonWords(o.seasonFrom, o.seasonTo)}`;
  if (o.who === 'early_bird' && o.minLeadMonths != null) {
    const m = o.minLeadMonths;
    return m >= 12 && m % 12 === 0 ? `Booked ${m === 12 ? 'a year' : `${m / 12} years`}+ ahead` : `Booked ${count(m)}+ months ahead`;
  }
  if (o.who === 'returning') return 'Couples who booked you before';
  return 'Everyone';
}

export function reachLabel(o: Pick<Offer, 'reachesAll' | 'cards'>): string {
  return o.reachesAll ? 'All cards' : o.cards.length ? nWord(o.cards.length, 'card', 'cards') : 'No cards';
}

/** "until switched off" · "until Nov 30, 2026". */
export function untilLine(o: Pick<Offer, 'untilDate'>): string {
  return o.untilDate ? `until ${shortDate(o.untilDate)}` : 'until switched off';
}

/** The row's second line: who · which cards · until. */
export const whoShort = (o: Offer) => `${whoLine(o)} · ${reachLabel(o)} · ${untilLine(o)}`;

/** The tile at the left of a row: the price parts stacked, then small marks for a first payment and a gift. */
export function whatTile(o: Offer): { bigs: string[]; small: string; marks: ('wallet' | 'gift')[]; tone: 'price' | 'first' | 'gift' | 'none' } {
  const bigs = hasPrice(o)
    ? [hasPct(o) ? pctWord(o.pctOff as number) : null, hasPhp(o) ? `${hasPct(o) ? '+' : ''}${php(o.phpOff as number)}` : null].filter((x): x is string => !!x)
    : hasFirstPayment(o)
      ? [o.firstPaymentUnit === 'pct' ? pctWord(o.firstPayment as number) : php(o.firstPayment as number)]
      : [];
  const small = hasPrice(o) ? 'off' : hasFirstPayment(o) ? 'reserve' : hasGift(o) ? 'gift' : '—';
  const marks: ('wallet' | 'gift')[] = [];
  if (hasPrice(o) && hasFirstPayment(o)) marks.push('wallet');
  if (hasGift(o) && (hasPrice(o) || hasFirstPayment(o))) marks.push('gift');
  const tone = hasPrice(o) ? 'price' : hasFirstPayment(o) ? 'first' : hasGift(o) ? 'gift' : 'none';
  return { bigs, small, marks, tone };
}

/** The pill couples read on a card (the prototype's badgeFor): "10% off" · "First 5 · ₱5,000 off". */
export function badgeWords(o: Offer): string {
  const w = priceWords(o);
  return o.who === 'first_n' && o.firstNCap != null ? `First ${count(o.firstNCap)} · ${w}` : w;
}

/** The written-for-you name a new offer starts with (＋ asks only for the first part; the supplier can change it). */
export function nameFor(o: Offer): string {
  const w = [priceWords(o), firstPaymentWords(o)].filter(Boolean).join(' · ');
  if (o.who === 'season') return w ? `Season offer · ${w}` : 'Season offer';
  if (o.who === 'early_bird') return w ? `Early bird · ${w}` : 'Early bird';
  return w || (hasGift(o) ? 'A gift with your booking' : 'New offer');
}

// ── 🏆 Across offers: the single best wins, never stacked ─────────────────────

const WHO_AS_TYPE: Readonly<Record<OfferWho, DiscountType>> = {
  everyone: 'promo',
  early_bird: 'early_booking',
  first_n: 'promo',
  season: 'off_peak',
  returning: 'returning',
};

/** The end of a Manila day, as an instant — "the last day a couple can book with it" includes that whole day. */
export const endOfManilaDay = (day: string) => `${day}T23:59:59+08:00`;

/**
 * The offers that reach `cardId`, as price candidates for `pickBestDiscount` (lib/vendor-service-public.ts) — the ONE
 * function that decides what couples see. Each RUNNING offer with a % or ₱ part becomes one candidate beside the card's
 * own `vendor_service_discounts` rows, so the couple gets the single one that saves them most; nothing stacks.
 *   · % and ₱ in one offer ride as one candidate (`unit 'pct'` + `then_php`): % first, then ₱ off what is left.
 *   · Early bird → an early_booking rung (`min_lead_months`), so the shipped ladder picks among them by event date.
 *   · Event date in a season → `event_from` / `event_to`: with the couple's event date known, an event outside the
 *     window drops it; without one, its label says the window.
 *   · How long → `expires_at` (the end of the last Manila day to book).
 * A first-N offer that is all taken, an ended offer, an Off offer and an offer with no price part give nothing here.
 */
export function offerCandidatesFor(offers: readonly Offer[], cardId: string, today: string): VendorServiceDiscount[] {
  const out: VendorServiceDiscount[] = [];
  for (const o of offers) {
    if (!reaches(o, cardId) || !hasPrice(o) || !isRunning(o, today)) continue;
    const pctOnly = hasPct(o);
    out.push({
      vendor_service_id: cardId,
      discount_type: WHO_AS_TYPE[o.who],
      rate: pctOnly ? (o.pctOff as number) : (o.phpOff as number),
      unit: pctOnly ? 'pct' : 'php',
      then_php: pctOnly && hasPhp(o) ? (o.phpOff as number) : null,
      min_lead_months: o.who === 'early_bird' ? o.minLeadMonths : null,
      expires_at: o.untilDate ? endOfManilaDay(o.untilDate) : null,
      event_from: o.who === 'season' ? o.seasonFrom : null,
      event_to: o.who === 'season' ? o.seasonTo : null,
      conditions_md: null,
      sort_order: -1000 + o.sortOrder,
      offer: {
        id: o.id,
        name: o.name,
        label:
          o.who === 'season' && o.seasonFrom && o.seasonTo
            ? `${priceWords(o)} · events ${seasonWords(o.seasonFrom, o.seasonTo)}`
            : badgeWords(o),
      },
    });
  }
  return out;
}

/**
 * A lower first payment never cuts the price: it goes TOGETHER with the best price result, and among first-payment
 * parts the LOWEST wins (9 Nov). `pay` is what couples pay on this card after the best price result.
 */
export function bestFirstPayment(offers: readonly Offer[], cardId: string, pay: number, today: string): { offer: Offer; amount: number } | null {
  let best: { offer: Offer; amount: number } | null = null;
  for (const o of offers) {
    if (!reaches(o, cardId) || !hasFirstPayment(o) || !isRunning(o, today)) continue;
    const amount = firstPaymentOf(o, pay);
    if (!best || amount < best.amount) best = { offer: o, amount };
  }
  return best;
}

// ── 🎁 Gifts ──────────────────────────────────────────────────────────────────

/**
 * 🔒 THE LIMIT, IN ONE PLACE (settled 10 Nov "all yes"): only Setnayan gifts count toward the gift limit. The
 * supplier's own extras and typed gifts cost Setnayan nothing and do not change the booking fee — no limit.
 */
export const limitApplies = (g: OfferGift) => g.kind === 'sn';

/** The gifts this offer gives on this card: the same list everywhere, or the card's own rows (Pick per card). */
export function giftsOn(o: Pick<Offer, 'giftMode' | 'gifts'>, cardId: string): OfferGift[] {
  return o.giftMode === 'per' ? o.gifts.filter((g) => g.card === cardId) : o.gifts.filter((g) => !g.card);
}

/** The same gift is the same gift whichever offer carries it. */
export function giftKey(g: OfferGift): string {
  return g.kind === 'sn' ? `sn:${g.code}` : g.kind === 'addon' ? `addon:${g.addonId}` : `typed:${g.label.trim().toLowerCase()}`;
}

export const packOf = (ctx: Pick<GiftContext, 'packs'>, code: string) => ctx.packs.find((p) => p.code === code) ?? null;
export const addonOf = (ctx: Pick<GiftContext, 'addons'>, id: number) => ctx.addons.find((a) => a.id === id) ?? null;

/** "Papic 1000 gift" · "Free extra hour" · the typed words. */
export function giftName(g: OfferGift, ctx: Pick<GiftContext, 'packs' | 'addons'>): string {
  if (g.kind === 'sn') return `${packOf(ctx, g.code)?.title ?? 'Setnayan'} gift`;
  if (g.kind === 'addon') {
    const label = addonOf(ctx, g.addonId)?.label ?? 'extra';
    return `Free ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  }
  return g.label.trim() || 'A gift';
}

/** What it is worth to the couple, in pesos; null = not said ("price on request"). */
export function giftWorth(g: OfferGift, ctx: Pick<GiftContext, 'packs' | 'addons'>): number | null {
  if (g.kind === 'sn') {
    const p = packOf(ctx, g.code);
    return p ? p.srpCentavos / 100 : null;
  }
  if (g.kind === 'addon') return addonOf(ctx, g.addonId)?.fromPhp ?? null;
  return g.worthPhp;
}

/** How many of this pack the shop can still give from stock (Papic counted in packs); null = stock unread. */
export function packsInStock(pack: ShopGiftPack, free: FreeByKind | null): number | null {
  return freeOfPack(free, pack);
}

/**
 * The stock line on a Setnayan gift row: "11 in stock · ₱499 each". 📦 ONE price per gift (14 Nov) — stock only says
 * whether it is already paid for; with none in stock it goes on the booking fee at the same price.
 */
export function stockLine(pack: ShopGiftPack, ctx: Pick<GiftContext, 'free'>): string {
  const n = packsInStock(pack, ctx.free);
  const head = n === null ? 'Couldn’t read your stock' : n > 0 ? `${count(n)} in stock` : 'none in stock';
  return `${head} · ${php(pack.srpCentavos / 100)} each`;
}

export type GiftVerdict = { gift: OfferGift; ok: boolean; why: string };
export type GiftCheck = { payPhp: number; limitCentavos: number; usedCentavos: number; items: GiftVerdict[] };

/**
 * One check per offer × card — the only place the limit rule lives. The limit adds up ALL the Setnayan gifts the card
 * gets from this offer, at LIST price, in row order, against the live limit at the price couples pay; the row that
 * pushes it over is flagged (not shown to couples) — never swapped. The always-allowed smallest Papic counts ₱0.
 * Own extras and typed gifts: no limit (settled 10 Nov).
 */
export function checkGifts(list: readonly OfferGift[], payPhp: number, ctx: GiftContext): GiftCheck {
  const limitCentavos = giftLimitCentavos(Math.round(payPhp * 100), ctx.schedule, ctx.limitPct);
  const smallest = alwaysAllowedPack(ctx.packs);
  let used = 0;
  const items = list.map((gift): GiftVerdict => {
    if (!limitApplies(gift)) return { gift, ok: true, why: gift.kind === 'addon' ? 'your extra · no limit' : 'your gift · no limit' };
    const pack = packOf(ctx, (gift as { code: string }).code);
    if (!pack) return { gift, ok: false, why: 'not on sale right now · not shown to couples' };
    if (smallest && pack.code === smallest.code) return { gift, ok: true, why: 'always allowed' };
    if (used + pack.srpCentavos > limitCentavos) {
      return { gift, ok: false, why: `doesn’t fit · ${php((used + pack.srpCentavos - limitCentavos) / 100)} over the ${php(limitCentavos / 100)} limit · not shown to couples` };
    }
    used += pack.srpCentavos;
    return { gift, ok: true, why: `fits · ${php(used / 100)} of the ${php(limitCentavos / 100)} limit` };
  });
  return { payPhp, limitCentavos, usedCentavos: used, items };
}

/**
 * The gifts a couple gets on this card: from every running offer that reaches it, each gift that fits at the price they
 * pay. 🔒 THE SAME GIFT IS GIVEN ONCE (settled 10 Nov) — the first offer in the list keeps it.
 */
export function giftsFor(offers: readonly Offer[], cardId: string, payPhp: number, today: string, ctx: GiftContext): { offer: Offer; gift: OfferGift }[] {
  const seen = new Set<string>();
  const out: { offer: Offer; gift: OfferGift }[] = [];
  for (const o of offers) {
    if (!reaches(o, cardId) || !isRunning(o, today)) continue;
    for (const v of checkGifts(giftsOn(o, cardId), payPhp, ctx).items) {
      if (!v.ok) continue;
      const k = giftKey(v.gift);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ offer: o, gift: v.gift });
    }
  }
  return out;
}

/**
 * 🎁 RECOMMENDED GIFTS (owner 9 Nov: "We will show recommended stacks"), built from the live limit only:
 * Good = the always-allowed smallest Papic · Better = the biggest Setnayan gift(s) that fit the limit at the price
 * couples pay (stock never caps it) · Best = Better + ONE own extra — the controller's rule, written in the ⓘ: the
 * highest-worth add-on from the card(s) that is not already on it.
 * 📐 AT MOST ONE PLAN GIFT PER SET (owner's pick 3, 14 Nov): the biggest Event Plus / Pro / Ultra that fits leads, the
 * rest is Papic — so Ultra can lead Better and Best, and a set never pairs two plans.
 */
export function recommendGifts(payPhp: number, cardIds: readonly string[], ctx: GiftContext): { good: OfferGift[]; better: OfferGift[]; best: OfferGift[] } {
  const smallest = alwaysAllowedPack(ctx.packs);
  const good: OfferGift[] = smallest ? [{ kind: 'sn', code: smallest.code }] : [];
  const lim = giftLimitCentavos(Math.round(payPhp * 100), ctx.schedule, ctx.limitPct);
  const better: OfferGift[] = [];
  let used = 0;
  let plan = false;
  for (const p of [...ctx.packs].filter((p) => p.code !== smallest?.code && p.srpCentavos <= lim).sort((a, b) => b.srpCentavos - a.srpCentavos)) {
    if (used + p.srpCentavos > lim) continue;
    if (p.kind !== 'papic' && plan) continue;
    better.push({ kind: 'sn', code: p.code });
    used += p.srpCentavos;
    if (p.kind !== 'papic') plan = true;
  }
  const b = better.length ? better : good;
  const own = ctx.addons.filter((a) => cardIds.includes(a.cardId)).sort((x, y) => (y.fromPhp ?? 0) - (x.fromPhp ?? 0))[0];
  return { good, better: b, best: own ? [...b, { kind: 'addon', addonId: own.id }] : b };
}

/**
 * What a stack costs the supplier per booking — ONE total at list price (📦 14 Nov: one price per gift), and which of its
 * Setnayan gifts are already paid for in stock: "₱11,488 · all 3 from your stock" · "₱999 · on the booking fee".
 */
export function stackCost(items: readonly OfferGift[], ctx: GiftContext): string {
  let total = 0;
  let gifts = 0;
  let stocked = 0;
  let unread = false;
  for (const g of items) {
    if (g.kind !== 'sn') continue;
    const p = packOf(ctx, g.code);
    if (!p) continue;
    gifts += 1;
    total += p.srpCentavos;
    const n = packsInStock(p, ctx.free);
    if (n === null) unread = true;
    else if (n > 0) stocked += 1;
  }
  if (gifts === 0) return 'costs you nothing';
  const where = unread
    ? 'couldn’t read your stock'
    : stocked === gifts
      ? gifts === 1
        ? 'from your stock'
        : `all ${count(gifts)} from your stock`
      : stocked === 0
        ? 'on the booking fee'
        : `${count(stocked)} of ${count(gifts)} from your stock`;
  return `${php(total / 100)} · ${where}`;
}

// ── The saved row ↔ the model ─────────────────────────────────────────────────

/** The columns the maker reads (`vendor_offers` + its picked cards). */
export const VENDOR_OFFER_SELECT =
  'public_id,name,reaches_all,pct_off,php_off,first_payment,first_payment_unit,gift_mode,gifts,who,min_lead_months,first_n_cap,first_n_taken,season_from,season_to,until_date,is_on,sort_order,vendor_offer_cards(vendor_service_id)';

export type VendorOfferRow = {
  public_id: string;
  name: string;
  reaches_all: boolean;
  pct_off: number | string | null;
  php_off: number | string | null;
  first_payment: number | string | null;
  first_payment_unit: string | null;
  gift_mode: string | null;
  gifts: unknown;
  who: string;
  min_lead_months: number | null;
  first_n_cap: number | null;
  first_n_taken: number | null;
  season_from: string | null;
  season_to: string | null;
  until_date: string | null;
  is_on: boolean;
  sort_order: number | null;
  vendor_offer_cards?: { vendor_service_id: string }[] | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Read the stored gift list defensively: an unknown shape is dropped, never guessed. */
export function parseOfferGifts(raw: unknown): OfferGift[] {
  if (!Array.isArray(raw)) return [];
  const out: OfferGift[] = [];
  for (const g of raw as Record<string, unknown>[]) {
    if (!g || typeof g !== 'object') continue;
    const card = typeof g.card === 'string' && g.card ? { card: g.card } : {};
    if (g.kind === 'addon' && Number.isInteger(Number(g.addon_id ?? g.addonId))) out.push({ kind: 'addon', addonId: Number(g.addon_id ?? g.addonId), ...card });
    else if (g.kind === 'sn' && typeof g.code === 'string' && g.code) out.push({ kind: 'sn', code: g.code, ...card });
    else if (g.kind === 'typed' && typeof g.label === 'string' && g.label.trim()) {
      out.push({ kind: 'typed', label: g.label.trim().slice(0, 80), worthPhp: num(g.worth_php ?? g.worthPhp), ...card });
    }
  }
  return out;
}

/** The model → the stored JSON (snake_case, as the migration's comment documents). */
export function giftsToJson(gifts: readonly OfferGift[]): Record<string, unknown>[] {
  return gifts.map((g) =>
    g.kind === 'addon'
      ? { kind: 'addon', addon_id: g.addonId, ...(g.card ? { card: g.card } : {}) }
      : g.kind === 'sn'
        ? { kind: 'sn', code: g.code, ...(g.card ? { card: g.card } : {}) }
        : { kind: 'typed', label: g.label, worth_php: g.worthPhp, ...(g.card ? { card: g.card } : {}) },
  );
}

export function offerFromRow(r: VendorOfferRow): Offer {
  const who = (OFFER_WHO as readonly string[]).includes(r.who) ? (r.who as OfferWho) : 'everyone';
  return {
    id: r.public_id,
    name: r.name,
    reachesAll: r.reaches_all,
    cards: (r.vendor_offer_cards ?? []).map((c) => c.vendor_service_id),
    pctOff: num(r.pct_off),
    phpOff: num(r.php_off),
    firstPayment: num(r.first_payment),
    firstPaymentUnit: r.first_payment_unit === 'pct' ? 'pct' : 'php',
    giftMode: r.gift_mode === 'per' ? 'per' : 'same',
    gifts: parseOfferGifts(r.gifts),
    who,
    minLeadMonths: r.min_lead_months ?? null,
    firstNCap: r.first_n_cap ?? null,
    firstNTaken: r.first_n_taken ?? 0,
    seasonFrom: r.season_from,
    seasonTo: r.season_to,
    untilDate: r.until_date,
    isOn: r.is_on,
    sortOrder: r.sort_order ?? 0,
  };
}

/** A fresh offer (＋ "What do they get?" turns its first part on in the editor). No money is guessed: every amount
 *  starts EMPTY and the supplier types it (owner 2026-08-31 "don't guess"). */
export function blankOffer(id = 'new'): Offer {
  return {
    id,
    name: '',
    reachesAll: true,
    cards: [],
    pctOff: null,
    phpOff: null,
    firstPayment: null,
    firstPaymentUnit: 'php',
    giftMode: 'same',
    gifts: [],
    who: 'everyone',
    minLeadMonths: null,
    firstNCap: null,
    firstNTaken: 0,
    seasonFrom: null,
    seasonTo: null,
    untilDate: null,
    isOn: true,
    sortOrder: 0,
  };
}

/** Why this offer cannot be saved yet, in the supplier's words; null = it can. */
export function offerProblem(o: Offer): string | null {
  if (!o.name.trim()) return 'Give it a name couples will read.';
  if (o.name.trim().length > 80) return 'Keep the name under 80 letters.';
  if (!o.reachesAll && o.cards.length === 0) return 'Pick at least one card, or choose All cards.';
  if (!partsOf(o).length) return 'Choose what they get under 3.';
  if (hasPct(o) && (o.pctOff as number) >= 100) return 'A % off must be under 100%.';
  if (hasFirstPayment(o) && o.firstPaymentUnit === 'pct' && (o.firstPayment as number) >= 100) return 'A first payment in % must be under 100%.';
  if (o.who === 'early_bird' && !(o.minLeadMonths && o.minLeadMonths >= 1 && o.minLeadMonths <= 600)) return 'Say how many months ahead they book.';
  if (o.who === 'first_n' && !(o.firstNCap && o.firstNCap >= 1)) return 'Say how many couples get it.';
  if (o.who === 'season') {
    if (!o.seasonFrom || !o.seasonTo) return 'Pick the first and last day of the season.';
    if (o.seasonFrom > o.seasonTo) return 'The season ends before it starts.';
  }
  return null;
}

// ── 🌙 The off-season offer starts from the shop's slow months (DECISION_LOG 2026-11-11) ──────────────────────────────

export type SeasonSuggestion = {
  from: string;
  to: string;
  /** "June, July, and August". */
  monthsLabel: string;
  /** Where the slow months came from — the shop's own calendar, the region's season, or the PH default. */
  source: 'own_calendar' | 'season_factors' | 'ph_default';
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * The next window that covers the shop's slow months (`deriveLeanMonths`, lib/vendor-lean-months.ts): from the first
 * day of the nearest upcoming slow month to the last day of the furthest one. A suggestion only — "Event date in a
 * season" opens on it and the supplier changes either day. null when there are no months.
 */
export function seasonFromLeanMonths(months: readonly number[], today: string, monthsLabel: string, source: SeasonSuggestion['source']): SeasonSuggestion | null {
  const valid = [...new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))];
  if (!valid.length) return null;
  const y = Number(today.slice(0, 4));
  const cur = Number(today.slice(5, 7));
  // A month still under way counts from next year, so the window never starts in the past.
  const next = valid.map((m) => ({ m, y: m > cur ? y : y + 1 })).sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
  const first = next[0]!;
  const last = next[next.length - 1]!;
  return {
    from: `${first.y}-${pad2(first.m)}-01`,
    to: `${last.y}-${pad2(last.m)}-${pad2(lastDayOf(last.y, last.m))}`,
    monthsLabel,
    source,
  };
}
