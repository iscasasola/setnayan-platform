/**
 * SUPPLIER GIFTS — the rules, PURE (no I/O, no `server-only`), so every one is unit-testable. The reads and writes
 * are `lib/shop-gifts.server.ts`; the ledger and the one delivery door are migration
 * `supplier_gifts_stock_quote_lines_and_delivery`.
 *
 * ⚖ OWNER RULINGS (DECISION_LOG 2026-11-04 — closed, do not re-ask):
 *   • a shop BUYS gifts ahead, in quantity, and keeps them as STOCK (Papic credits as a credit balance);
 *   • gifts are offered ONLY on service cards and quotes, and ONLY while in stock ("buy first");
 *   • they leave the stock when that couple's FIRST PAYMENT clears, and land on the couple's EVENT;
 *   • a Verified-and-up shop pays the catalogue's GIFT price (`gift_price_php`); Free pays the list price;
 *   • a shop's gifts on one booking are capped at 40% of that booking's fee, measured at the price couples pay —
 *     the SAME gift limit as the Setnayan gift (`limitPct`, the admin setting, never re-typed) — and the smallest Papic
 *     pack ("Papic 150") is ALWAYS allowed, even above the limit.
 *
 * 🔑 THE ALWAYS-ALLOWED PACK IS DERIVED, NOT TYPED: it is the smallest active pack on the live catalogue
 * ("they can always give the lowest gift at any price. that is the lowest papic."). Typing 150 here would freeze a
 * number the admin can change.
 *
 * 💎 SLICE 2 (2026-11-05) — Event Plus and Event Pro are gifts too, kept as COUNTS beside the Papic credit balance.
 * For those two kinds one "credit" is ONE unlock: a pack's `credits` is 1, the stock moves ±1, a quote line gives 1.
 * At the first payment the gift unlocks the EVENT; a second Event Plus on an event that already holds Plus unlocks
 * Event Pro instead (owner 2026-11-05: *"yes, the second event plus will auto upgrade event pro"*). An event that
 * already holds Event Pro cannot take either — the quote says so before it is sent.
 *
 * 🏅 BADGE REWARDS (2026-11-05) — a badge's Papic 150 / Event Plus / Event Pro lands in this same stock, marked
 * "Badge reward" (migration `badge_rewards_land_in_the_gift_stock`). Owner: *"badge rewards are exempt from the
 * 40%-of-booking-fee gift limit … bought gifts keep the limit"*. So a quote's lines are paid from the shop's REWARD
 * stock first (`allocateRewardLines`, whole lines, the most valuable first) and only the lines left — the bought ones —
 * are measured against the limit.
 */

import { bookingFeePhp, type BookingFeeSchedule } from './booking-fee';
import { EVENT_PLUS_SKU, FULL_PRO_SKU } from './hub-parts';
import { giftLimitPctOrDefault } from './setnayan-gift';
import { EVENT_ULTRA_SKU } from './event-ultra';

/**
 * What a gift is: Papic credits, or one Event Plus / Event Pro / Event Ultra unlock. The migrations' CHECKs say the same
 * four (💎 Ultra: owner 2026-11-13, "Gifting Ultra: yes" — migration 20271345709071).
 */
export type ShopGiftKind = 'papic' | 'event_plus' | 'event_pro' | 'event_ultra';

export const SHOP_GIFT_KINDS: readonly ShopGiftKind[] = ['papic', 'event_plus', 'event_pro', 'event_ultra'];

/** The couple product each unlock kind is (a `platform_retail_catalog_v2.service_code`). */
export const SHOP_GIFT_UNLOCK_CODE: Readonly<Record<Exclude<ShopGiftKind, 'papic'>, string>> = {
  event_plus: EVENT_PLUS_SKU,
  event_pro: FULL_PRO_SKU,
  event_ultra: EVENT_ULTRA_SKU,
};

/** The kind of a giftable product code, or null when it cannot be gifted. */
export function shopGiftKindOf(code: string | null | undefined): ShopGiftKind | null {
  if (typeof code !== 'string') return null;
  if (/^PAPIC_GUEST(_[A-Z0-9]+)?$/.test(code)) return 'papic';
  if (code === SHOP_GIFT_UNLOCK_CODE.event_plus) return 'event_plus';
  if (code === SHOP_GIFT_UNLOCK_CODE.event_pro) return 'event_pro';
  if (code === SHOP_GIFT_UNLOCK_CODE.event_ultra) return 'event_ultra';
  return null;
}

/**
 * What the couple's event already holds, from the app's entitlement chain — Event Pro includes everything Plus has, and
 * Event Ultra everything Pro has.
 */
export type EventHolds = 'none' | 'plus' | 'pro' | 'ultra';

/**
 * Can an event that holds `has` still take a gift of `kind`? An unlock never lands on an event that already holds that
 * plan or a higher one — except that an Ultra gift reaching a Plus or Pro event gives full Ultra (owner 2026-11-13).
 * The delivery door (`shop_gift_deliver_unlocks_for_booking`) applies the same rule.
 */
export function eventCanTake(kind: ShopGiftKind, has: EventHolds): boolean {
  if (kind === 'papic') return true;
  if (has === 'ultra') return false;
  if (has === 'pro') return kind === 'event_ultra';
  return true;
}

/** The order key a GIFT purchase is minted under — `vendor_gift__<couple product code>`. */
export const SHOP_GIFT_KEY_PREFIX = 'vendor_gift__';

export function shopGiftServiceKey(code: string): string {
  return SHOP_GIFT_KEY_PREFIX + code;
}

/** The gifted product's code, or null for any other key: a `PAPIC_GUEST*` pack, Event Plus or Event Pro. */
export function shopGiftCodeOf(serviceKey: string | null | undefined): string | null {
  if (typeof serviceKey !== 'string' || !serviceKey.startsWith(SHOP_GIFT_KEY_PREFIX)) return null;
  const code = serviceKey.slice(SHOP_GIFT_KEY_PREFIX.length);
  return shopGiftKindOf(code) ? code : null;
}

/** How many of one pack a single gift order may buy (the migration's CHECK says the same). */
export const SHOP_GIFT_MAX_QUANTITY = 100;

/** One giftable pack, as the catalogue says it today. Money in whole centavos. */
export type ShopGiftPack = {
  code: string;
  title: string;
  kind: ShopGiftKind;
  /** Papic credits ONE pack adds — or 1 for an Event Plus / Event Pro unlock. */
  credits: number;
  /** The price couples pay — what the 40% limit is measured in. */
  srpCentavos: number;
  /** What a Verified-and-up shop pays; null ⇒ this pack has no gift price and everyone pays `srpCentavos`. */
  giftPriceCentavos: number | null;
};

/**
 * Packs from the catalogue rows (`fetchShopPapicPacks` + `fetchShopGiftUnlockRows`): the Papic packs smallest first,
 * then Event Plus, then Event Pro, then Event Ultra. Bad rows — and any code that cannot be gifted — are dropped.
 */
export function shopGiftPacksFrom(
  rows: ReadonlyArray<{ code: string; title: string; credits: number; pricePhp: number; giftPricePhp?: number | null }>,
): ShopGiftPack[] {
  const out: ShopGiftPack[] = [];
  for (const r of rows) {
    if (!r || typeof r.code !== 'string' || !Number.isInteger(r.credits) || r.credits <= 0) continue;
    const kind = shopGiftKindOf(r.code);
    if (!kind || (kind !== 'papic' && r.credits !== 1)) continue;
    const srp = Math.round(Number(r.pricePhp) * 100);
    if (!Number.isFinite(srp) || srp <= 0) continue;
    const g = r.giftPricePhp == null ? NaN : Math.round(Number(r.giftPricePhp) * 100);
    out.push({
      code: r.code,
      title: r.title || r.code,
      kind,
      credits: r.credits,
      srpCentavos: srp,
      giftPriceCentavos: Number.isFinite(g) && g > 0 ? g : null,
    });
  }
  const order = (p: ShopGiftPack) => SHOP_GIFT_KINDS.indexOf(p.kind);
  return out.sort((a, b) => order(a) - order(b) || a.credits - b.credits);
}

/** The pack that is always allowed on a quote — the smallest PAPIC pack on the live catalogue. */
export function alwaysAllowedPack(packs: readonly ShopGiftPack[]): ShopGiftPack | null {
  return packs.find((p) => p.kind === 'papic') ?? null;
}

/** What one pack gives, as people read it: "1,000 Papic credits" · "Unlocks Event Plus on their event". */
export function giftPackLine(pack: Pick<ShopGiftPack, 'kind' | 'credits' | 'title'>): string {
  return pack.kind === 'papic' ? `${giftCount(pack.credits)} Papic credits` : `Unlocks ${pack.title} on their event`;
}

/**
 * Does a shop on this plan pay the GIFT price? Verified and up do; Free (unverified) pays the list price (owner
 * 2026-11-04, "okay 10% for verified and up accounts" · "free only SRP"). The ONE answer — the server read
 * (`fetchVendorPaysGiftPrice`) and the /for-suppliers plan table both ask it.
 */
export function tierPaysGiftPrice(tier: string | null | undefined): boolean {
  return typeof tier === 'string' && tier !== 'free';
}

/** What this shop pays for ONE pack: the gift price when it is Verified-and-up and the pack has one, else the list. */
export function giftUnitPrice(
  pack: ShopGiftPack,
  paysGiftPrice: boolean,
): { centavos: number; basis: 'gift' | 'list' } {
  if (paysGiftPrice && pack.giftPriceCentavos != null && pack.giftPriceCentavos < pack.srpCentavos) {
    return { centavos: pack.giftPriceCentavos, basis: 'gift' };
  }
  return { centavos: pack.srpCentavos, basis: 'list' };
}

/**
 * The gift LIMIT for a quote of `totalCentavos`: `limitPct`% of its booking fee, in whole centavos, FLOORED (the
 * limit can never exceed that share by a centavo). The fee comes from `bookingFeePhp` under the LIVE schedule, and
 * `limitPct` from the live admin setting (`getGiftLimitPct`, owner 8 Nov 2026) — never a re-typed rate.
 */
export function giftLimitCentavos(totalCentavos: number, schedule: BookingFeeSchedule, limitPct: number): number {
  if (!Number.isFinite(totalCentavos) || totalCentavos <= 0) return 0;
  const feeCentavos = Math.round(bookingFeePhp(totalCentavos / 100, schedule) * 100);
  return Math.floor((feeCentavos * giftLimitPctOrDefault(limitPct)) / 100);
}

/**
 * What is left of each kind's BADGE-REWARD stock: earned − used (`shop_gift_reward_stock_status`), never more than
 * what is free to offer at all. Null when either could not be read — then no line is treated as a reward.
 */
export function rewardFreeByKind(
  reward: Readonly<Partial<Record<ShopGiftKind, { earned: number; used: number }>>> | null,
  free: FreeByKind | null,
): FreeByKind | null {
  if (!reward || !free) return null;
  // A kind the reader did not answer for counts as no reward (never as stock to hand out).
  const left = (k: ShopGiftKind) => Math.max(0, Math.min(free[k] ?? 0, (reward[k]?.earned ?? 0) - (reward[k]?.used ?? 0)));
  return { papic: left('papic'), event_plus: left('event_plus'), event_pro: left('event_pro'), event_ultra: left('event_ultra') };
}

/** The stock a shop can still offer: balance − what live quotes hold. `null` = could not be read. */
export type ShopGiftStock = {
  /** SUM of the ledger. */
  balance: number;
  /** Promised on live quotes, not yet given. */
  held: number;
};

export function freeCredits(stock: ShopGiftStock | null): number | null {
  if (!stock) return null;
  return Math.max(0, stock.balance - stock.held);
}

/** The stock of every kind. `null` = could not be read (never zeros). */
export type ShopGiftStocks = Readonly<Record<ShopGiftKind, ShopGiftStock>>;

/** What can still be offered of each kind. */
export type FreeByKind = Readonly<Record<ShopGiftKind, number>>;

export function freeByKind(stocks: ShopGiftStocks | null): FreeByKind | null {
  if (!stocks) return null;
  return {
    papic: freeCredits(stocks.papic) ?? 0,
    event_plus: freeCredits(stocks.event_plus) ?? 0,
    event_pro: freeCredits(stocks.event_pro) ?? 0,
    event_ultra: freeCredits(stocks.event_ultra) ?? 0,
  };
}

/** The verdict on a quote's gifts. */
export type QuoteGiftsVerdict = {
  lines: ShopGiftPack[];
  /** Papic credits only. */
  credits: number;
  /** Event Plus / Event Pro / Event Ultra unlocks on the quote. */
  unlocks: { event_plus: number; event_pro: number; event_ultra: number };
  /** At the price couples pay. */
  valueCentavos: number;
  limitCentavos: number;
  /** Only the always-allowed pack — fits whatever the limit. */
  alwaysAllowed: boolean;
  /** Per CODE handed in (same order): this line is paid from badge-reward stock, outside the limit. */
  fromReward: boolean[];
  /** Value of the badge-reward lines, at the price couples pay — not measured against the limit. */
  rewardCentavos: number;
  state: 'none' | 'ok' | 'over_limit' | 'short' | 'unknown_pack' | 'already_has';
  /** Missing from stock (state 'short') — credits for Papic, units for an unlock. */
  shortBy: number;
  /** Which kind is short (state 'short'). */
  shortKind: ShopGiftKind | null;
};

/**
 * Which lines the shop's BADGE-REWARD stock pays (owner 2026-11-05: badge rewards sit outside the 40% limit). Whole
 * lines only — a reward never pays part of a pack — and the most valuable lines first, so the exemption covers as much
 * as the reward stock can. `rewardFree` is what is left of each kind's reward stock (never more than the free stock).
 */
export function allocateRewardLines(lines: readonly ShopGiftPack[], rewardFree: FreeByKind | null): boolean[] {
  const left: Record<ShopGiftKind, number> = {
    papic: Math.max(0, rewardFree?.papic ?? 0),
    event_plus: Math.max(0, rewardFree?.event_plus ?? 0),
    event_pro: Math.max(0, rewardFree?.event_pro ?? 0),
    event_ultra: Math.max(0, rewardFree?.event_ultra ?? 0),
  };
  const out = lines.map(() => false);
  const order = lines.map((_, i) => i).sort((a, b) => lines[b]!.srpCentavos - lines[a]!.srpCentavos || a - b);
  for (const i of order) {
    const p = lines[i]!;
    if (left[p.kind] >= p.credits) {
      left[p.kind] -= p.credits;
      out[i] = true;
    }
  }
  return out;
}

/**
 * Judge the gifts a supplier put on a quote. The server runs this before it writes the lines; the composer runs the
 * SAME function to draw the block, so the two can never disagree.
 *
 * @param codes    the packs added, one entry per pack (two Papic 1000 ⇒ the code twice)
 * @param limitPct the live gift limit (`ShopGiftQuoteBasis.limitPct`, Admin › Gifts) — binds the BOUGHT lines only
 * @param free     what is free to offer of each kind, from `freeByKind` — `null` (stock unread) judges as short
 * @param eventHas what the couple's event already holds — `eventCanTake` says which unlocks it can still take
 * @param rewardFree what is left of the shop's BADGE-REWARD stock, per kind — those lines sit outside the limit
 */
export function judgeQuoteGifts(
  codes: readonly string[],
  packs: readonly ShopGiftPack[],
  totalCentavos: number,
  schedule: BookingFeeSchedule,
  limitPct: number,
  free: FreeByKind | null,
  eventHas: EventHolds = 'none',
  rewardFree: FreeByKind | null = null,
): QuoteGiftsVerdict {
  const limitCentavos = giftLimitCentavos(totalCentavos, schedule, limitPct);
  const byCode = new Map(packs.map((p) => [p.code, p]));
  const lines: ShopGiftPack[] = [];
  const lineOfCode: number[] = [];
  let unknown = false;
  for (const c of codes) {
    const p = byCode.get(c);
    if (p) {
      lineOfCode.push(lines.length);
      lines.push(p);
    } else {
      lineOfCode.push(-1);
      unknown = true;
    }
  }
  const need = (k: ShopGiftKind) => lines.reduce((s, p) => s + (p.kind === k ? p.credits : 0), 0);
  const credits = need('papic');
  const unlocks = { event_plus: need('event_plus'), event_pro: need('event_pro'), event_ultra: need('event_ultra') };
  const valueCentavos = lines.reduce((s, p) => s + p.srpCentavos, 0);
  const rewardLines = allocateRewardLines(lines, rewardFree);
  const fromReward = lineOfCode.map((i) => i >= 0 && rewardLines[i] === true);
  const bought = lines.filter((_, i) => !rewardLines[i]);
  const rewardCentavos = valueCentavos - bought.reduce((s, p) => s + p.srpCentavos, 0);
  const boughtCentavos = valueCentavos - rewardCentavos;
  const smallest = alwaysAllowedPack(packs);
  // The limit binds only the BOUGHT lines: none at all, or only the smallest pack, always fits.
  const alwaysAllowed = bought.length === 0 || (bought.length === 1 && !!smallest && bought[0]!.code === smallest.code);
  const base = {
    lines,
    credits,
    unlocks,
    valueCentavos,
    limitCentavos,
    alwaysAllowed,
    fromReward,
    rewardCentavos,
    shortBy: 0,
    shortKind: null,
  };

  if (unknown) return { ...base, state: 'unknown_pack' };
  if (lines.length === 0) return { ...base, state: 'none' };
  if (lines.some((p) => !eventCanTake(p.kind, eventHas))) return { ...base, state: 'already_has' };
  if (!alwaysAllowed && boughtCentavos > limitCentavos) return { ...base, state: 'over_limit' };
  for (const k of SHOP_GIFT_KINDS) {
    const have = free?.[k] ?? 0;
    if (need(k) > have) return { ...base, state: 'short', shortBy: need(k) - have, shortKind: k };
  }
  return { ...base, state: 'ok' };
}

/** What the quote builder needs to draw "Gifts from you" and re-judge it as the total moves. */
export type ShopGiftQuoteBasis = {
  packs: ShopGiftPack[];
  schedule: BookingFeeSchedule;
  /** 🎁 The live gift limit, % of the booking fee (`getGiftLimitPct`, Admin › Gifts, owner 8 Nov 2026). Never typed. */
  limitPct: number;
  /** Free to offer on THIS quote, per kind (this event's old holds left out). Null = could not be read. */
  free: FreeByKind | null;
  /** What the couple's event already holds — Plus, Pro and Ultra gifts read it. */
  eventHas: EventHolds;
  /** What is left of the shop's BADGE-REWARD stock, per kind (outside the limit). Null / absent = none counted. */
  rewardFree?: FreeByKind | null;
};

/** One choice in the "＋ Add a gift" menu. */
export type GiftMenuOption = {
  code: string;
  title: string;
  /** False ⇒ shown disabled with `why`. */
  ok: boolean;
  why: string | null;
};

/**
 * The add menu: every pack, each saying whether it can go on THIS quote now. A pack that would break the limit or
 * that stock cannot cover is listed with the reason, so "buy first" is said where the choice is made.
 */
export function addGiftMenu(
  codes: readonly string[],
  packs: readonly ShopGiftPack[],
  totalCentavos: number,
  schedule: BookingFeeSchedule,
  limitPct: number,
  free: FreeByKind | null,
  eventHas: EventHolds = 'none',
  rewardFree: FreeByKind | null = null,
): GiftMenuOption[] {
  return packs.map((p) => {
    const v = judgeQuoteGifts([...codes, p.code], packs, totalCentavos, schedule, limitPct, free, eventHas, rewardFree);
    if (v.state === 'ok') return { code: p.code, title: p.title, ok: true, why: null };
    if (v.state === 'already_has') {
      return { code: p.code, title: p.title, ok: false, why: `Their event already has ${eventHas === 'ultra' ? 'Event Ultra' : 'Event Pro'}` };
    }
    if (v.state === 'over_limit') return { code: p.code, title: p.title, ok: false, why: 'Over this booking’s gift limit' };
    if (v.state === 'short') return { code: p.code, title: p.title, ok: false, why: 'Not enough in your stock · buy first' };
    return { code: p.code, title: p.title, ok: false, why: 'Not on sale right now' };
  });
}

/** "1,000" — a count as people read it. */
export function giftCount(n: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(n);
}

/** Unlock titles on a quote, in order — the catalogue's own titles ("Event Plus", "Event Pro", "Event Ultra"). */
export type GiftUnlockTitles = readonly string[];

/**
 * The couple's line for one quote: "Gift from Saysay Studio 🎁 · 1,150 Papic credits · Event Plus". Null when the
 * quote gives nothing.
 */
export function coupleGiftHeadline(
  credits: number,
  shopName: string | null | undefined,
  unlocks: GiftUnlockTitles = [],
): string | null {
  const parts = [
    ...(Number.isFinite(credits) && credits > 0 ? [`${giftCount(credits)} Papic credits`] : []),
    ...unlocks.filter((t) => typeof t === 'string' && t.trim().length > 0),
  ];
  if (parts.length === 0) return null;
  const from = shopName?.trim() ? `Gift from ${shopName.trim()}` : 'A gift from your supplier';
  return `${from} 🎁 · ${parts.join(' · ')}`;
}

/** Where the couple's gift stands. */
export type CoupleGiftState = 'promised' | 'given';

export function coupleGiftDetail(state: CoupleGiftState, hasUnlock = false, hasCredits = false): string {
  if (hasUnlock && hasCredits) {
    return state === 'given' ? 'Added to your event.' : 'Added to your event when your first payment is confirmed.';
  }
  if (hasUnlock) {
    return state === 'given' ? 'Unlocked on your event.' : 'Unlocked on your event when your first payment is confirmed.';
  }
  return state === 'given'
    ? 'Added to your event’s Papic credits.'
    : 'Added to your event’s Papic credits when your first payment is confirmed.';
}

/** The same gift as the SUPPLIER reads it on their own sent quote. */
export function supplierGiftDetail(state: CoupleGiftState): string {
  return state === 'given'
    ? 'Given — it left your gift stock and is on their event.'
    : 'Leaves your gift stock when their first payment clears.';
}

/** The supplier's stock row sub-line: "850 free to offer · 300 on sent quotes" (credits, or Plus / Pro counts). */
export function stockSubline(stock: ShopGiftStock | null): string {
  if (!stock) return 'Couldn’t read your gifts right now';
  const free = freeCredits(stock) ?? 0;
  const held = stock.held > 0 ? ` · ${giftCount(stock.held)} on sent quotes` : '';
  return `${giftCount(free)} free to offer${held}`;
}
