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
import { resolveReachBadge } from '@/lib/vendor-service-radius';
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

/* ─── PART 2 (owner 2026-10-07 · the prototype's `SHEETS.supplier`) ─────────
 * The supplier's own photos, the rest of what they offer ("Ask about X"),
 * Follow and Share — and the sheet for a supplier who is not yet the couple's.
 * Since 2026-10-08 (the minimum-request rules) the sheet is drawn at once from
 * what the pressed card already holds; everything below arrives in ONE small
 * request (`readSupplierSheet`) and never re-renders the page. */

/** How many photos the sheet draws — one row of three, "+N" on the last. */
export const SHEET_PHOTO_LIMIT = 3;

/**
 * The supplier's own published photos as the prototype's one row: at most
 * three squares, the last carrying "+N" for the rest. Their OWN photos only —
 * the ones on their public page — never anything from a couple's gallery.
 */
export function sheetPhotoRow(urls: readonly string[], limit: number = SHEET_PHOTO_LIMIT): { shown: string[]; more: number } {
  const clean = urls.filter((u) => typeof u === 'string' && u.length > 0);
  const shown = clean.slice(0, limit);
  return { shown, more: Math.max(0, clean.length - shown.length) };
}

/** "Their work · 14 photos" — the count is of what was read. */
export function sheetPhotosHeading(total: number): string {
  return `Their photos · ${formatCount(total)} ${total === 1 ? 'photo' : 'photos'}`;
}

/** One other category the supplier offers. */
export type SheetOther = { tile: string; label: string };

/**
 * "The rest of their portfolio": every OTHER category the supplier has a live
 * service in, once each, in the order their services were made. A category
 * with no row on the Suppliers page (no tile) is left out rather than guessed.
 */
export function sheetOthers(
  serviceCategories: readonly (string | null | undefined)[],
  currentTile: string | null,
  resolve: (category: string) => SheetOther | null,
): SheetOther[] {
  const seen = new Set<string>(currentTile ? [currentTile] : []);
  const out: SheetOther[] = [];
  for (const c of serviceCategories) {
    if (!c) continue;
    const other = resolve(c);
    if (!other || seen.has(other.tile)) continue;
    seen.add(other.tile);
    out.push(other);
  }
  return out;
}

/** What the ONE request returns. Every field keeps "could not read" (null)
 *  apart from "there is none". */
export type SupplierSheetData = {
  reviews: SheetReview[] | null;
  work: SheetWork[];
  workTotal: number;
  /** Their published photos — null when the read failed OR their name is still
   *  withheld (a photo can name a shop as surely as its name does). */
  photos: string[] | null;
  /** The other categories they offer — null when the read failed. */
  others: SheetOther[] | null;
  /** The couple follows them — null when it could not be read. */
  following: boolean | null;
  /** Their public page, for Share — null while their name is withheld. */
  sharePath: string | null;
};

/** The words while the one request is out, and when it fails. */
export const SHEET_LOADING = 'Loading their reviews and photos…';
export const SHEET_FAILED = 'Couldn’t load their reviews and photos.';

/** The message "Ask about X" would be about — the row's own words. */
export function askAboutLabel(label: string): string {
  return `Ask about ${label}`;
}

/** One "why they fit" line — the SAME reach / budget / date signals the card
 *  shows, decided once here for the sheet and the desktop inspector alike. */
export type SheetFit = { tone: 'ok' | 'warn'; kind: 'reach' | 'budget' | 'date'; inRange?: boolean; text: string };

export function sheetFits(v: {
  distanceKm: number | null;
  innerRadiusKm: number | null;
  outerRadiusKm: number | null;
  reachesVenue: boolean | null;
  serviceRadiusKm: number | null;
  budgetFit: 'fits' | 'over' | null;
  budgetEstimated: boolean;
  dateFit: 'free' | 'booked' | null;
}): SheetFit[] {
  const fits: SheetFit[] = [];
  // The helper owns the precedence (a declared ring wins; else the tier-derived
  // read; else nothing) — the card, the inspector and the sheet cannot differ.
  const reach = resolveReachBadge({
    distanceKm: v.distanceKm,
    innerKm: v.innerRadiusKm,
    outerKm: v.outerRadiusKm,
    reachesVenue: v.reachesVenue,
    serviceRadiusKm: v.serviceRadiusKm,
  });
  if (reach) fits.push({ tone: reach.tone, kind: 'reach', inRange: reach.inRange, text: reach.text });
  if (v.budgetFit === 'fits') fits.push({ tone: 'ok', kind: 'budget', text: v.budgetEstimated ? 'Fits budget · est.' : 'Fits budget' });
  else if (v.budgetFit === 'over') fits.push({ tone: 'warn', kind: 'budget', text: v.budgetEstimated ? 'Over budget · est.' : 'Over budget' });
  if (v.dateFit === 'free') fits.push({ tone: 'ok', kind: 'date', text: 'Free on your date' });
  else if (v.dateFit === 'booked') fits.push({ tone: 'warn', kind: 'date', text: 'Booked that day' });
  return fits;
}

/**
 * Where things stand with this supplier in this category — the line under the
 * service card (the prototype's `stateOf`). The supplier's price is on the card
 * above it, so it is not repeated here.
 */
export function sheetStateLine(s: {
  booked: boolean;
  /** Asked to book; no yes yet. */
  asked: boolean;
  quoteIn: boolean;
  inBuild: boolean;
  hasThread: boolean;
  selfAdded: boolean;
}): string {
  if (s.booked) return 'Booked';
  if (s.asked) return 'Asked to book · waiting for their yes';
  if (s.quoteIn) return 'Quote in';
  if (s.inBuild) return 'In your build';
  if (s.hasThread) return 'Asked for a quote';
  return s.selfAdded ? 'Added by you' : 'Saved';
}
