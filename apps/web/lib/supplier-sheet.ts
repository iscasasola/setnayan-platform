/**
 * supplier-sheet.ts — WHAT THE SUPPLIER SHEET SAYS (owner 2026-10-07 · Suppliers
 * PR2: "Press the card → the supplier sheet: badges → the service card → proof:
 * why they fit · ★ + reviews (words + date) · their work … by event type ·
 * month (NO guest or event names)").
 *
 * Pure. The sheet is the page's shipped quick-view (`VendorQuickViewInspector`)
 * opened in place at every width; this decides what three of its sections say.
 *
 * 🔑 NOTHING HERE CAN NAME A GUEST, A COUPLE OR AN EVENT. A review is its
 * stars, its month and its words; a piece of work is the KIND of event and the
 * month. Neither type has a field a name could arrive in, so a later edit
 * cannot leak one by "just passing the row through".
 */
import type { BenchServiceCard } from '@/lib/bench-service-card';
import { PRICE_ON_REQUEST } from '@/lib/bench-service-card';
import { formatCount } from '@/lib/format-number';
import type { Snapshot } from '@/lib/service-card-snapshot';
import {
  formatEventTypeLabel,
  formatTrackRecordMonth,
  type ReviewRow,
  type VendorCompletedEventRow,
} from '@/lib/reviews';

/** How many of each the sheet shows — it is a glance, the full profile has all. */
export const SHEET_REVIEW_LIMIT = 3;
export const SHEET_WORK_LIMIT = 6;

/**
 * The supplier's service card as `ServiceCardFace` draws it. The face takes a
 * `Snapshot`; the bench carries the already-decided `BenchServiceCard` (prices
 * withheld where the shop hides them), so this only re-shapes — it never
 * re-derives a price.
 *
 * No card (added by the couple, or not linked to one) → the category names it
 * and nothing is claimed about a price unless the cards were actually read.
 */
export function sheetSnapshot(
  card: BenchServiceCard | null,
  opts: { categoryLabel: string; cardsRead: boolean; selfAdded: boolean },
): Snapshot {
  return {
    name: card?.name || opts.categoryLabel,
    priceText: card?.priceText ?? (opts.cardsRead && !opts.selfAdded ? PRICE_ON_REQUEST : ''),
    discountBadge: card?.discountBadge ?? null,
    includesLine: card?.includesLine ?? null,
    notIncluded: card?.notIncluded ?? [],
    // The retired free-text perk is not read for this page (see the face).
    hasExclusive: false,
    givesSetnayanGift: card?.givesSetnayanGift ?? false,
    hasCover: Boolean(card?.coverUrl),
  };
}

export type SheetReview = {
  id: string;
  /** 1–5, whole stars. */
  stars: number;
  /** "Dec 2025" — null when the date cannot be read. */
  month: string | null;
  words: string;
};

function monthOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short' });
}

/**
 * The newest reviews that carry WORDS. A star rating with nothing written is
 * already in the average printed above them; listing it as a "review" would be
 * a row with nothing to read.
 */
export function sheetReviews(rows: readonly ReviewRow[], limit: number = SHEET_REVIEW_LIMIT): SheetReview[] {
  const out: SheetReview[] = [];
  for (const r of rows) {
    const words = (r.body ?? '').trim();
    if (!words) continue;
    out.push({
      id: r.review_id,
      stars: Math.max(1, Math.min(5, Math.round(r.rating_overall))),
      month: monthOf(r.created_at),
      words,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export type SheetWork = {
  id: string;
  /** The KIND of event — "Wedding", "Debut". Never its name. */
  kind: string;
  /** "Dec 2025" — null when neither date is set. */
  month: string | null;
};

/** Their completed events through Setnayan, newest first — kind and month only. */
export function sheetWork(rows: readonly VendorCompletedEventRow[], limit: number = SHEET_WORK_LIMIT): SheetWork[] {
  return rows.slice(0, limit).map((r) => ({
    id: r.vendor_id,
    kind: formatEventTypeLabel(r.event_type),
    month: formatTrackRecordMonth(r),
  }));
}

/** "3 events through Setnayan" — the count is of what was READ, so it is only
 *  ever printed beside a list that is on screen. */
export function sheetWorkHeading(total: number): string {
  return `Their work · ${formatCount(total)} ${total === 1 ? 'event' : 'events'} through Setnayan · newest first`;
}
