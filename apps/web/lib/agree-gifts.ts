/**
 * GIFT FOR SERVICES — the gifts a supplier picks for the couple's event when they AGREE to a booking. PURE (no I/O,
 * no `server-only`), so every rule is unit-testable; the server reads are `lib/agree-gifts.server.ts`, and the one
 * write is the SQL door `booking_gift_pick` (migration `gifts_picked_when_the_supplier_agrees`), which re-judges
 * every pick from a fresh read — this file draws the sheet, the database decides.
 *
 * ⚖ OWNER RULINGS (DECISION_LOG 2026-11-15, "GIFT FOR SERVICES DESIGN — DECISIONS"; closed, do not re-ask):
 *   • the supplier picks Papic packs, Event Plus, Event Pro or Event Ultra — a plan gift and Papic may be combined;
 *   • everything picked together is capped at the gift limit (the admin's `gift_limit_pct`, 40 by default) of THIS
 *     booking's fee, counted at the price couples pay — the LIST price (`retail_price_php`; "one price per gift",
 *     14 Nov). Event Ultra counts at its list price;
 *   • the smallest Papic pack ("Papic 150") is always allowed;
 *   • STOCK FIRST — what the shop already holds shows "In your stock" and costs nothing more, but still counts toward
 *     the limit; the rest is added to the supplier's booking-fee bill;
 *   • "Most credits for your limit" (the best Papic mix, one tap) shows only when the gift is all Papic and a better
 *     mix exists;
 *   • at most one plan gift (pick 3, 14 Nov); Plus + Pro never make Ultra (pick 2).
 *
 * 🔒 NO PRICE IS TYPED HERE. Every figure is a pack's catalogue price handed in by the server read.
 */

import {
  alwaysAllowedPack,
  eventCanTake,
  freeOfPack,
  type EventHolds,
  type FreeByKind,
  type ShopGiftPack,
} from './shop-gifts';
import { giftLimitPctOrDefault } from './setnayan-gift';

/** The most lines one pick may carry — the SQL door refuses more (`too_many`). */
export const AGREE_GIFT_MAX_LINES = 40;

/** Everything the picker needs, resolved on the server for ONE booking ask. Money in whole centavos. */
export type AgreeGiftBasis = {
  /** The live giftable packs at their LIST price (`fetchShopGiftPacks`). */
  packs: ShopGiftPack[];
  /** This booking's fee — what the yes will bill (`bookingFeePhp` on the agreed total, the live schedule). */
  feeCentavos: number;
  /** The live gift limit, % of the booking fee (`getGiftLimitPct`). */
  limitPct: number;
  /** What the shop can still offer from its gift stock (every event's holds counted). Null = could not be read. */
  free: FreeByKind | null;
  /** What the couple's event already holds. */
  eventHas: EventHolds;
  /**
   * 🎁 NO BILL (owner 2026-11-16, DECISION_LOG 03e465e1): a free, promo, badge-paid or imported booking raises no bill, so
   * nothing can be bought — the supplier may still give from stock they already hold, within the limit of the fee the
   * booking WOULD have carried (`feeCentavos`). Absent / false → a billed booking.
   */
  stockOnly?: boolean;
};

/** The limit for one booking: `limitPct`% of its fee, FLOORED — the SQL door's own arithmetic. */
export function agreeGiftLimitCentavos(feeCentavos: number, limitPct: number): number {
  if (!Number.isFinite(feeCentavos) || feeCentavos <= 0) return 0;
  return Math.floor((Math.round(feeCentavos) * giftLimitPctOrDefault(limitPct)) / 100);
}

export type AgreeGiftLine = { pack: ShopGiftPack; fromStock: boolean };

export type AgreeGiftState =
  | 'none'
  | 'ok'
  | 'unknown_pack'
  | 'already_has'
  | 'one_plan'
  | 'over_limit'
  | 'too_many'
  | 'stock_only';

export type AgreeGiftVerdict = {
  lines: AgreeGiftLine[];
  state: AgreeGiftState;
  /** Everything picked, at the list price — what the limit measures. */
  valueCentavos: number;
  /** Only what was not in stock — what the bill adds. */
  boughtCentavos: number;
  limitCentavos: number;
  /** Papic credits picked (all lines). */
  credits: number;
};

/**
 * Judge a pick. `codes` holds one entry per pack or plan (two Papic 1000 ⇒ the code twice), in the order picked. The
 * SAME order of checks as `booking_gift_pick`: unknown → a plan the event holds → more than one plan → the limit; then
 * stock first, per code, the earliest lines first.
 */
export function judgeAgreeGifts(codes: readonly string[], basis: AgreeGiftBasis): AgreeGiftVerdict {
  const limitCentavos = agreeGiftLimitCentavos(basis.feeCentavos, basis.limitPct);
  const byCode = new Map(basis.packs.map((p) => [p.code, p]));
  const picked: ShopGiftPack[] = [];
  let unknown = false;
  for (const c of codes) {
    const p = byCode.get(c);
    if (p) picked.push(p);
    else unknown = true;
  }
  const valueCentavos = picked.reduce((s, p) => s + p.srpCentavos, 0);
  const credits = picked.reduce((s, p) => s + (p.kind === 'papic' ? p.credits : 0), 0);

  // Stock first, per code: the first `free` lines of that code come out of stock.
  const usedOf = new Map<string, number>();
  const lines: AgreeGiftLine[] = picked.map((pack) => {
    const have = freeOfPack(basis.free, pack) ?? 0;
    const used = usedOf.get(pack.code) ?? 0;
    const fromStock = used < have;
    if (fromStock) usedOf.set(pack.code, used + 1);
    return { pack, fromStock };
  });
  const boughtCentavos = lines.reduce((s, l) => s + (l.fromStock ? 0 : l.pack.srpCentavos), 0);
  const base = { lines, valueCentavos, boughtCentavos, limitCentavos, credits };

  if (unknown) return { ...base, state: 'unknown_pack' };
  if (picked.length === 0) return { ...base, state: 'none' };
  if (picked.length > AGREE_GIFT_MAX_LINES) return { ...base, state: 'too_many' };
  if (picked.some((p) => !eventCanTake(p.kind, basis.eventHas))) return { ...base, state: 'already_has' };
  if (picked.filter((p) => p.kind !== 'papic').length > 1) return { ...base, state: 'one_plan' };
  const smallest = alwaysAllowedPack(basis.packs);
  const aloneSmallest = picked.length === 1 && !!smallest && picked[0]!.code === smallest.code;
  if (valueCentavos > limitCentavos && !aloneSmallest) return { ...base, state: 'over_limit' };
  // No bill: every line must come from stock — the SQL door's own last check (`stock_only`).
  if (basis.stockOnly && lines.some((l) => !l.fromStock)) return { ...base, state: 'stock_only' };
  return { ...base, state: 'ok' };
}

/** One row of the picker: a pack, what one costs, how many are in stock, and whether one more can be added now. */
export type AgreeGiftOption = {
  pack: ShopGiftPack;
  /** How many of THIS pack are picked. */
  count: number;
  /** Free to offer from stock (null = could not be read). */
  inStock: number | null;
  canAdd: boolean;
  /** Why one more cannot be added, in the supplier's words. */
  why: string | null;
};

/** The picker's rows: every pack on sale, each saying whether one more fits THIS booking now. */
export function agreeGiftOptions(codes: readonly string[], basis: AgreeGiftBasis): AgreeGiftOption[] {
  return basis.packs.map((pack) => {
    const count = codes.filter((c) => c === pack.code).length;
    const inStock = freeOfPack(basis.free, pack);
    const next = judgeAgreeGifts([...codes, pack.code], basis);
    const why =
      next.state === 'ok'
        ? null
        : next.state === 'already_has'
          ? `Their event already has ${basis.eventHas === 'ultra' ? 'Event Ultra' : 'Event Pro'}`
          : next.state === 'one_plan'
            ? 'One plan per gift'
            : next.state === 'over_limit'
              ? 'Over this booking’s gift limit'
              : next.state === 'too_many'
                ? 'That is the most one gift can hold'
                : next.state === 'stock_only'
                  ? 'Not in your stock — this booking has no bill to buy on'
                  : 'Not on sale right now';
    return { pack, count, inStock, canAdd: next.state === 'ok', why };
  });
}

/**
 * "MOST CREDITS FOR YOUR LIMIT" — the Papic mix that gives the most credits within the limit, as codes (biggest
 * pack first). Stock lines cost nothing more but still count toward the limit, so the mix is measured at the list
 * price alone. Below the smallest pack's price, the smallest pack alone (always allowed). Empty when no Papic pack
 * is on sale.
 *
 * Exhaustive over the packs on sale (three today): the count of every pack but the cheapest is tried, the cheapest
 * fills what is left. Bounded by `AGREE_GIFT_MAX_LINES`, so it never proposes a pick the door would refuse.
 */
export function bestPapicMix(basis: AgreeGiftBasis): string[] {
  const papic = basis.packs.filter((p) => p.kind === 'papic').sort((a, b) => b.srpCentavos - a.srpCentavos);
  if (papic.length === 0) return [];
  const limit = agreeGiftLimitCentavos(basis.feeCentavos, basis.limitPct);
  const cheapest = papic[papic.length - 1]!;
  const smallest = alwaysAllowedPack(basis.packs);
  let best: { credits: number; lines: number; counts: number[] } = { credits: 0, lines: 0, counts: [] };

  const walk = (i: number, left: number, linesLeft: number, counts: number[], credits: number) => {
    const pack = papic[i]!;
    if (i === papic.length - 1) {
      const k = Math.min(Math.floor(left / pack.srpCentavos), linesLeft);
      const total = credits + k * pack.credits;
      const used = AGREE_GIFT_MAX_LINES - linesLeft + k;
      if (total > best.credits || (total === best.credits && used < best.lines)) {
        best = { credits: total, lines: used, counts: [...counts, k] };
      }
      return;
    }
    const max = Math.min(Math.floor(left / pack.srpCentavos), linesLeft);
    for (let k = max; k >= 0; k -= 1) {
      walk(i + 1, left - k * pack.srpCentavos, linesLeft - k, [...counts, k], credits + k * pack.credits);
    }
  };
  walk(0, limit, AGREE_GIFT_MAX_LINES, [], 0);

  if (best.credits === 0) return smallest && limit < cheapest.srpCentavos ? [smallest.code] : [];
  return papic.flatMap((p, i) => Array.from({ length: best.counts[i] ?? 0 }, () => p.code));
}

/**
 * Show "Most credits for your limit"? Only when the gift is ALL Papic (empty counts as all Papic) and the best mix
 * gives more credits than what is picked now (owner 2026-11-15).
 */
export function offersBetterPapicMix(codes: readonly string[], basis: AgreeGiftBasis): boolean {
  // No bill: the gift is whatever stock holds — a mix to BUY is not on offer.
  if (basis.stockOnly) return false;
  const byCode = new Map(basis.packs.map((p) => [p.code, p]));
  const picked = codes.map((c) => byCode.get(c));
  if (picked.some((p) => !p || p.kind !== 'papic')) return false;
  const now = picked.reduce((s, p) => s + (p?.credits ?? 0), 0);
  const best = bestPapicMix(basis).reduce((s, c) => s + (byCode.get(c)?.credits ?? 0), 0);
  return best > now;
}

/**
 * The gift row's words above Agree. `null` when nothing is picked. "2 × Papic 1000 · Event Pro" — Papic counted in
 * packs, then the plan, the catalogue's own titles.
 */
export function agreeGiftItems(lines: readonly AgreeGiftLine[]): string | null {
  const papic = new Map<string, number>();
  const plans: string[] = [];
  for (const l of lines) {
    if (l.pack.kind === 'papic') papic.set(l.pack.title, (papic.get(l.pack.title) ?? 0) + 1);
    else plans.push(l.pack.title);
  }
  const parts = [...[...papic].map(([t, k]) => `${new Intl.NumberFormat('en-PH').format(k)} × ${t}`), ...plans];
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** What the yes's redirect says about the gift (`?gift=<status>`), as the supplier reads it. Null = say nothing. */
export function agreeGiftOutcomeLine(status: string | null | undefined): { tone: 'ok' | 'refused'; text: string } | null {
  switch (status) {
    case 'ok':
      return { tone: 'ok', text: 'Your gift is on this booking. It reaches the couple once your bill is paid — stock gifts at their first payment.' };
    case 'over_limit':
      return { tone: 'refused', text: 'Your gift did not go on: it was over this booking’s gift limit. The booking is agreed.' };
    case 'already_has':
      return { tone: 'refused', text: 'Your gift did not go on: their event already has that plan. The booking is agreed.' };
    case 'stock_only':
      return { tone: 'refused', text: 'Your gift did not go on: this booking has no bill, so only gifts already in your stock can be given. The booking is agreed.' };
    case 'no_fee':
      return { tone: 'refused', text: 'Your gift did not go on: this booking has no fee to size a gift by. The booking is agreed.' };
    case 'unknown_pack':
      return { tone: 'refused', text: 'Your gift did not go on: something in it is no longer on sale. The booking is agreed.' };
    case 'one_plan':
      return { tone: 'refused', text: 'Your gift did not go on: one plan per gift. The booking is agreed.' };
    case 'error':
      return { tone: 'refused', text: 'We couldn’t add your gift just now. The booking is agreed — nothing was added to your bill.' };
    default:
      return null;
  }
}
