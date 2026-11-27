/**
 * 🪟 THE SHOP'S ONE COUNTING WINDOW (L6 · S3, walk 27 Nov 2026: Today said "207 views · last 28 days" while Your page
 * said "214 opened · 30 d" — the same reader, `readCouplesWhoOpened`, over two windows, so one shop had two numbers).
 *
 * Every supplier figure that counts "lately" — Today's Views and Inquiries, Your page's "opened", Shop › Analytics' first
 * window — counts the same days: the Analytics window the owner approved ("One window = Last 30 days · Last 12 months",
 * `GROWTH_WINDOWS` in `lib/analytics-growing.ts`). The words are built from the number, never typed beside it, so the
 * read and the label cannot drift apart again (Today's "the read IS the days it says" rule).
 *
 * PURE — client components and tests share it.
 * 🔒 lib/shop-count-window.test.ts
 */
import { formatCount } from '@/lib/format-number';

/** The days a "lately" count covers — Analytics' first window ('30'). */
export const SHOP_COUNT_WINDOW_DAYS = 30;


const DAY_MS = 86_400_000;

/** The window's start, as an ISO timestamp, for the readers' `since`. */
export function shopCountSinceIso(nowMs: number): string {
  return new Date(nowMs - SHOP_COUNT_WINDOW_DAYS * DAY_MS).toISOString();
}

/** The window's start in epoch ms — for counting rows already read. */
export function shopCountSinceMs(nowMs: number): number {
  return nowMs - SHOP_COUNT_WINDOW_DAYS * DAY_MS;
}

/** "last 30 days" — Today's stat line. */
export const SHOP_COUNT_WINDOW_WORDS = `last ${formatCount(SHOP_COUNT_WINDOW_DAYS)} days`;

/** "30 d" — the short form a pinned figure wears. */
export const SHOP_COUNT_WINDOW_SHORT = `${formatCount(SHOP_COUNT_WINDOW_DAYS)} d`;

/** "opened · 30 d" — Your page's pinned "opened" figure. */
export const SHOP_OPENED_WORD = `opened · ${SHOP_COUNT_WINDOW_SHORT}`;
