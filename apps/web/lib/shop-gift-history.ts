/**
 * 🧾 YOUR GIFTS › TRANSACTION HISTORY — the rules, PURE (owner-approved prototype `gifts-interactive` v16, 2026-11-17).
 *
 * The history is its own screen (‹ Your gifts): what the shop BOUGHT (each order, with where it stands) and the gifts it
 * GAVE (each stock row that went to a couple's event). The reads are `fetchShopGiftHistory` (lib/shop-gifts.server.ts);
 * this file decides the words, so a unit test can hold them.
 *
 * Where a bought order stands — the prototype's two pills, plus the two an honest list also needs:
 *   · 'in_stock'  "In your gifts"          — approved; its tickets landed;
 *   · 'sent'      "Waiting for approval"   — the payment was sent (a reference or a screenshot is logged), not yet approved;
 *   · 'unpaid'    "Not paid yet"           — minted, nothing sent yet (opens its payment page again);
 *   · 'refunded'  "Refunded"               — taken back.
 * A cancelled or lapsed order that never landed was never a purchase and is not listed.
 */

import { giftCount, type ShopGiftKind } from './shop-gifts';

export type GiftOrderState = 'in_stock' | 'sent' | 'unpaid' | 'refunded';

export const GIFT_ORDER_PILL: Readonly<Record<GiftOrderState, string>> = {
  in_stock: 'In your gifts',
  sent: 'Waiting for approval',
  unpaid: 'Not paid yet',
  refunded: 'Refunded',
};

/** Where one bought order stands, or null when it is not listed (left unpaid and closed). */
export function giftOrderState(o: {
  landed: boolean;
  reversed: boolean;
  orderStatus: string | null | undefined;
  /** A payment for it carries a bank reference or a screenshot. */
  proofSent: boolean;
}): GiftOrderState | null {
  if (o.reversed || o.orderStatus === 'refunded') return 'refunded';
  if (o.landed) return 'in_stock';
  if (o.orderStatus === 'cancelled' || o.orderStatus === 'lapsed') return null;
  return o.proofSent ? 'sent' : 'unpaid';
}

/** One bought line as the history words it: "Papic 150 ×2" · "Papic 1000 10 + 1". */
export function boughtItemWords(line: { title: string; qty: number; bundle: boolean }): string {
  const name = line.bundle ? `${line.title} 10 + 1` : line.title;
  return line.qty > 1 ? `${name} ×${giftCount(line.qty)}` : name;
}

/** The row's title: "You bought · Event Plus" for one item, "You bought · 3 items" for more. */
export function boughtTitle(lines: ReadonlyArray<{ title: string; bundle: boolean }>): string {
  if (lines.length === 1) return `You bought · ${lines[0]!.bundle ? `${lines[0]!.title} 10 + 1` : lines[0]!.title}`;
  return `You bought · ${giftCount(lines.length)} items`;
}

/** How many tickets one given stock row moved: Papic counts packs, an unlock counts units. */
export function givenCount(row: { gift_kind: ShopGiftKind | string; packs: number | null; delta: number }): number {
  if (row.gift_kind === 'papic') return Math.abs(row.packs ?? 0) || 1;
  return Math.abs(row.delta) || 1;
}

/** One row of the history, newest first. */
export type GiftHistoryRow =
  | {
      kind: 'bought';
      key: string;
      orderId: string;
      referenceCode: string | null;
      createdAt: string;
      title: string;
      items: string;
      paidPhp: number;
      tickets: number;
      state: GiftOrderState;
    }
  | {
      kind: 'given';
      key: string;
      createdAt: string;
      giftTitle: string;
      count: number;
      eventName: string | null;
    };

/** The Your gifts top row's "Given": every ticket that went to a couple's event. */
export function givenTotal(rows: readonly GiftHistoryRow[]): number {
  return rows.reduce((s, r) => s + (r.kind === 'given' ? r.count : 0), 0);
}

/** "Mon 16 Nov, 8:10 PM" — the history's date, in Manila time. */
export function historyWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  return `${date}, ${time}`;
}

/** "November 2026" — the history's month heading. */
export function historyMonth(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
}
