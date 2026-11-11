/**
 * lib/bundle-sums.ts — 🧺 THE BUNDLE MAKER'S SUMS, IN ONE PLACE (Build 6 · Lane D; owner 9 Nov 2026, DECISION_LOG
 * "SHOP › DISCOUNTS PAGE · BUNDLE MAKER TOTALS…" + "A BUNDLE = 2+ SERVICE CARDS + ITS OWN PINNED PRICE + OFFER
 * SWITCHES; GIFTS LIVE ONLY IN OFFERS…"; prototype specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/
 * bundle-maker.html` v3 — the prototype is the contract).
 *
 *   1. Each picked card counts at its LOWEST price: the card's own price minus its best discount that is on.
 *   2. Cards at their lowest are summed.
 *   3. The EXTRA BUNDLE DISCOUNT comes off that sum — pesos only, never a percent; above ₱0 and below the sum
 *      (0 = no extra discount).
 *   4. NEW TOTAL = the sum − the extra. It IS the bundle's one price (`vendor_packages.total_price_centavos`); nothing
 *      is typed for it any more.
 *   5. The bundle's PAYMENT PLAN starts as a copy of the default plan and must add up to exactly the new total; its
 *      last payment is the automatic "Final balance" (the shipped `resolveSchedule`, never a second resolver).
 *   6. "What the couple gets" gathers every inclusion of the picked cards, merged and de-duplicated, each labelled
 *      with the card it came from.
 *
 * The maker runs these on every keystroke for the pinned New total; the server action runs THE SAME functions on
 * card prices and discounts IT read, and writes only what it computed (the client's total is never trusted).
 *
 * ── "ITS BEST DISCOUNT THAT IS ON" — the controller's reading until the Offer Maker lands ──────────────────────
 * A bundle's price is fixed for every couple, so only a discount that reaches EVERY couple may lower it. Of the
 * shipped `vendor_service_discounts` types, two do: `promo` (until its date) and `bundle`. The other three depend on
 * the couple — `early_booking` (how far ahead THEY book), `off_peak` (THEIR event date), `returning` (THEIR history)
 * — so counting them into a fixed price would hand every couple a discount only some qualify for. The ranking is the
 * shipped `pickBestDiscount` (most pesos saved wins, never stacked). ⏭ When the Offer Maker's ONE server "best"
 * function ships (Build 6 Lane D, another session), `cardLowest` calls it instead — one swap, here.
 *
 * PURE: no I/O, no React. 🔒 lib/bundle-sums.test.ts
 */
import { pickBestDiscount } from './vendor-service-public';
import type { VendorServiceDiscount } from './vendor-services';
import {
  DEFAULT_QUOTE_PLAN,
  resolveSchedule,
  type AutoBalanceMeta,
  type InstallmentDraft,
  type ResolvedSchedule,
} from './proposal-payment-schedule';

/** One of the shop's service cards, as the maker and the save both read it. Prices in whole pesos (the card's). */
export type BundleCardFacts = {
  id: string;
  name: string;
  /** `vendor_services.starting_price_php` — the card's "from ₱X"; null = the card has no price yet. */
  pricePhp: number | null;
  discounts: readonly VendorServiceDiscount[];
  /** The card's free inclusions (`vendor_service_inclusions`), in the card's own order. */
  inclusions: readonly { label: string }[];
};

/** The discount types that reach EVERY couple — the only ones a fixed bundle price may count (module header). */
export const DISCOUNTS_FOR_EVERY_COUPLE = ['promo', 'bundle'] as const;

/** Does this discount lower the bundle's fixed price? Every couple qualifies, and it has not ended. */
export function countsForEveryCouple(d: VendorServiceDiscount, now: Date): boolean {
  if (!(DISCOUNTS_FOR_EVERY_COUPLE as readonly string[]).includes(d.discount_type)) return false;
  return !(d.expires_at && Date.parse(d.expires_at) <= now.getTime());
}

export type CardLowest = {
  id: string;
  name: string;
  /** The card's own price; null = unpriced (the bundle cannot be totalled until it has one). */
  pricePhp: number | null;
  /** The price after its best discount that is on (= pricePhp when none is on). */
  lowestPhp: number | null;
  /** The winning discount's words ("10% off · limited-time"), or null when none is on. */
  offer: string | null;
};

/** One card at its lowest price. */
export function cardLowest(card: BundleCardFacts, now: Date): CardLowest {
  if (card.pricePhp == null || !(card.pricePhp > 0)) {
    return { id: card.id, name: card.name, pricePhp: null, lowestPhp: null, offer: null };
  }
  const best = pickBestDiscount(
    card.discounts.filter((d) => countsForEveryCouple(d, now)),
    card.pricePhp,
    { now },
  );
  const lowest = Math.max(0, card.pricePhp - (best?.savingsPhp ?? 0));
  return { id: card.id, name: card.name, pricePhp: card.pricePhp, lowestPhp: lowest, offer: best?.label ?? null };
}

export type BundleSums = {
  lines: CardLowest[];
  /** Σ of every priced card at its lowest, in pesos. */
  cardsTotalPhp: number;
  /** Σ of the cards' own prices (the struck "card sum" a couple sees above the bundle's price). */
  cardsListPhp: number;
  extraPhp: number;
  /** cardsTotalPhp − extraPhp, never below 0. */
  newTotalPhp: number;
  /** Cards with no price yet — the total cannot be trusted while any is here. */
  unpriced: string[];
};

/** The whole sum for the picked cards (in the order picked) and the typed extra discount. */
export function bundleSums(picked: readonly BundleCardFacts[], extraPhp: number, now: Date): BundleSums {
  const lines = picked.map((c) => cardLowest(c, now));
  const cardsTotalPhp = lines.reduce((a, l) => a + (l.lowestPhp ?? 0), 0);
  const cardsListPhp = lines.reduce((a, l) => a + (l.pricePhp ?? 0), 0);
  const extra = Number.isFinite(extraPhp) ? Math.max(0, Math.round(extraPhp)) : 0;
  return {
    lines,
    cardsTotalPhp,
    cardsListPhp,
    extraPhp: extra,
    newTotalPhp: Math.max(0, cardsTotalPhp - extra),
    unpriced: lines.filter((l) => l.lowestPhp == null).map((l) => l.name),
  };
}

/** The one-line under the pinned New total — "2 cards · ₱139,000 − ₱9,000" · "Pick cards to see it". */
export function pinnedTotalLine(sums: BundleSums, php: (n: number) => string): string {
  const n = sums.lines.length;
  if (n === 0) return 'Pick cards to see it';
  const cards = `${n} ${n === 1 ? 'card' : 'cards'}`;
  return sums.extraPhp > 0 ? `${cards} · ${php(sums.cardsTotalPhp)} − ${php(sums.extraPhp)}` : `${cards} · at their lowest`;
}

/** A bundle is TWO or more service cards (owner 9 Nov: "a bundle card is service card/s + offer card", ruled 2+). */
export const MIN_BUNDLE_CARDS = 2;

export type BundleProblem = {
  code: 'bundle_needs_two_cards' | 'bundle_card_unpriced' | 'bundle_extra_not_below_total' | 'bundle_plan_over_total';
  message: string;
};

/** Every reason the sums cannot be saved yet — all at once, never the first only. */
export function bundleProblems(sums: BundleSums, plan: ResolvedSchedule | null, php: (n: number) => string): BundleProblem[] {
  const out: BundleProblem[] = [];
  if (sums.lines.length < MIN_BUNDLE_CARDS) {
    out.push({ code: 'bundle_needs_two_cards', message: 'A bundle is two or more of your service cards — add another card.' });
  }
  for (const name of sums.unpriced) {
    out.push({ code: 'bundle_card_unpriced', message: `${name} has no price yet — set it on the card first.` });
  }
  if (sums.extraPhp > 0 && sums.extraPhp >= sums.cardsTotalPhp) {
    out.push({ code: 'bundle_extra_not_below_total', message: 'The extra discount has to be below the total.' });
  }
  if (plan && !plan.balances) {
    out.push({ code: 'bundle_plan_over_total', message: `The payments add up to more than ${php(sums.newTotalPhp)}.` });
  }
  return out;
}

/** The plan as stored on the bundle — the editor's drafts (migration 20271336630678). */
export type BundlePlanDrafts = { manual: InstallmentDraft[]; autoBalance: AutoBalanceMeta };

/** The bundle's plan drafts: its own when it has one, else a COPY of the default (never the default object itself). */
export function planDraftsOrDefault(stored: BundlePlanDrafts | null | undefined): BundlePlanDrafts {
  const src = stored && Array.isArray(stored.manual) && stored.manual.length > 0 ? stored : DEFAULT_QUOTE_PLAN;
  return { manual: src.manual.map((d) => ({ ...d })), autoBalance: { ...src.autoBalance } };
}

/** Resolve the plan against the new total — the shipped resolver; the last row is the automatic balance. */
export function resolveBundlePlan(drafts: BundlePlanDrafts, newTotalPhp: number): ResolvedSchedule {
  return resolveSchedule({ manual: drafts.manual, autoBalance: drafts.autoBalance, baseCentavos: Math.round(newTotalPhp * 100), creditCentavos: 0 });
}

/** Read a stored `payment_schedule_json` defensively — a shape it does not know is "no plan of its own", never a throw. */
export function parseBundlePlan(raw: unknown): BundlePlanDrafts | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { manual?: unknown; autoBalance?: unknown };
  if (!Array.isArray(o.manual) || o.manual.length === 0 || !o.autoBalance || typeof o.autoBalance !== 'object') return null;
  return { manual: o.manual as InstallmentDraft[], autoBalance: o.autoBalance as AutoBalanceMeta };
}

/** An included line is words only — no peso (owner 11 Nov 2026); the bundle's one price sums CARD prices. */
export type GatheredLine = { label: string; card: string };

/** "What the couple gets": every inclusion of the picked cards, merged case-insensitively, labelled with its card. */
export function gatherInclusions(picked: readonly BundleCardFacts[]): GatheredLine[] {
  const out: GatheredLine[] = [];
  for (const c of picked) {
    for (const inc of c.inclusions) {
      const label = inc.label.trim();
      if (!label || out.some((x) => x.label.toLowerCase() === label.toLowerCase())) continue;
      out.push({ label, card: c.name });
    }
  }
  return out;
}

/** The bundle's price in centavos — what `total_price_centavos` stores. */
export const totalCentavos = (sums: BundleSums): number => Math.round(sums.newTotalPhp * 100);
