/**
 * shop-quote.ts — THE SHOP PAGE'S ONE QUOTE (shop website v16 S3, owner 15 Nov 2026; prototype
 * `shop_website_two_looks_2026-11-15` v16 `syncQuote`). Pure, so every rule is executed by its guard.
 *
 * A couple taps "Add to quote" on the service cards they want; the tray says what is in the quote —
 * "2 services · from ₱45,000" and the names — and its Inquire opens the shop's ONE Inquire pop-up with exactly those
 * services picked (`data-inquire-service`, inquire-sheet.tsx). Nothing is saved or sent until that Inquire is sent:
 * the quote lives in the page, on the device (prototype `ST.svc`).
 *
 * 🔑 THE SUM IS NEVER A GUESS: it adds only the starting prices the shop shows (`starting_price_php`, the same number
 * the card's "from ₱X" is drawn from). A picked service with no shown price ("Price on request") is said as such —
 * never counted as ₱0, never left out silently.
 * 🔒 lib/the-shop-quote-follows-v16-s3.test.ts
 */
import { formatCount } from './format-number';
import { formatPhpRounded } from './php';

/** One card as the quote needs it: its id, its name, and its shown starting price (null = "Price on request"). */
export type QuoteCard = { id: string; label: string; fromPhp: number | null };

/** The shown starting price of one service row, or null when the card says "Price on request" (`toServiceCard`). */
export function quotePriceOf(row: { starting_price_php: number | null }, hidePrices: boolean): number | null {
  return !hidePrices && row.starting_price_php !== null && row.starting_price_php > 0 ? row.starting_price_php : null;
}

/** Add or take out one service, keeping the order they were picked in (the first pick files the shop on Find). */
export function toggleQuote(picked: readonly string[], id: string): string[] {
  return picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
}

/** The tray's two lines: "2 services · from ₱45,000" and "Photo booth · Same-day edit". null = nothing picked. */
export function quoteSummary(picked: readonly string[], cards: readonly QuoteCard[]): { head: string; names: string } | null {
  const inQuote = picked.map((id) => cards.find((c) => c.id === id)).filter((c): c is QuoteCard => !!c);
  if (inQuote.length === 0) return null;
  const priced = inQuote.filter((c) => c.fromPhp !== null);
  const sum = priced.reduce((n, c) => n + (c.fromPhp ?? 0), 0);
  const unpriced = inQuote.length - priced.length;
  const count = `${formatCount(inQuote.length)} service${inQuote.length === 1 ? '' : 's'}`;
  const price =
    priced.length === 0 ? ' · price on request' : ` · from ${formatPhpRounded(sum)}${unpriced > 0 ? ' + price on request' : ''}`;
  return { head: `${count}${price}`, names: inQuote.map((c) => c.label).join(' · ') };
}
