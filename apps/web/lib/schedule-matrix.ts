/**
 * Schedule Matrix — "Find your date" engine.
 *
 * Lock: CLAUDE.md 2026-06-02 "Schedule Matrix & Date Finder"; canonical spec
 * Schedule_Matrix_and_Date_Finder_2026-06-02.md.
 *
 * The wedding date is an OUTPUT: given the couple's candidate dates + their
 * shortlisted vendors, return which date keeps the most of those vendors
 * available, plus the per-date vendor combination ("who works together on
 * this date"). Runs entirely on the existing availability engine
 * (vendor_calendar_blocks via lib/vendor-availability.ts) — no new schema.
 *
 * Honesty (V1, RA-10173-clean): a vendor with no calendar blocks reads as
 * "open" — the UI labels it "no conflict on file · confirm with vendor", it
 * never asserts "confirmed free". A vendor is "booked" only when their
 * calendar actually blocks the day. Off-platform picks (no
 * marketplace_vendor_id) can't be checked → "unknown". Empty calendars stay
 * truthful while vendors fill them (auto-block-on-deposit, V1.x follow-up).
 *
 * Candidate columns: an exact date → that one day; a fuzzy month/year window →
 * the Saturdays inside it (Filipino weddings cluster on Saturdays), capped, so
 * the matrix never explodes to 31 columns.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeCandidateWindow,
  getBatchVendorAvailableDays,
  formatDayKey,
  type EventDatePrecision,
} from './vendor-availability';
import { displayServiceLabel } from './vendors';

export type MatrixVendorState = 'open' | 'booked' | 'unknown';

export type MatrixVendor = {
  key: string;
  name: string;
  isTopPick: boolean;
  state: MatrixVendorState;
};

export type MatrixCategory = {
  category: string;
  label: string;
  vendors: MatrixVendor[];
  /** ≥1 vendor open (or off-platform, which can't constrain the date). */
  covered: boolean;
  /** The category's top pick is still available on this date. */
  topPickKept: boolean;
};

export type MatrixDate = {
  dateKey: string;
  label: string;
  dow: string;
  categories: MatrixCategory[];
  coveredCount: number;
  totalCategories: number;
  topPicksKept: number;
  isBest: boolean;
};

export type ScheduleMatrix = {
  hasDate: boolean;
  hasShortlist: boolean;
  /** True when the couple has a single fixed day (one column, no ranking). */
  exactDate: boolean;
  /** Picks we cannot check availability for (off-platform / no marketplace id). */
  offPlatformCount: number;
  dates: MatrixDate[];
};

export type SchedulePick = {
  key: string;
  category: string | null;
  name: string;
  marketplaceVendorId: string | null;
  /** Lower = more committed / earlier; index 0 within a category = top pick. */
  rank: number;
};

const MAX_CANDIDATE_COLUMNS = 6;

function labelFor(dateKey: string): { label: string; dow: string } {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    dow: dt.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

/**
 * Reduce a precision window to a handful of candidate columns:
 *  - exact day  → that one day
 *  - month/year → the Saturdays in the window, capped; falls back to a weekly
 *                 stride if (defensively) no Saturday lands in range.
 */
function candidateColumns(start: Date, end: Date, exact: boolean): string[] {
  if (exact) return [formatDayKey(start)];
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last && keys.length < MAX_CANDIDATE_COLUMNS) {
    if (cursor.getDay() === 6) keys.push(formatDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (keys.length > 0) return keys;
  const fallback = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (fallback <= last && keys.length < MAX_CANDIDATE_COLUMNS) {
    keys.push(formatDayKey(fallback));
    fallback.setDate(fallback.getDate() + 7);
  }
  return keys;
}

export async function buildScheduleMatrix(args: {
  admin: SupabaseClient;
  eventDate: string | null;
  precision: EventDatePrecision | null;
  picks: SchedulePick[];
}): Promise<ScheduleMatrix> {
  const { admin, eventDate, precision, picks } = args;

  const marketplacePicks = picks.filter((p) => p.marketplaceVendorId);
  const offPlatformCount = picks.length - marketplacePicks.length;
  const hasShortlist = picks.length > 0;

  const window = eventDate && precision ? computeCandidateWindow(eventDate, precision) : null;
  if (!window) {
    return { hasDate: false, hasShortlist, exactDate: false, offPlatformCount, dates: [] };
  }

  const exact = precision === 'day';
  const columns = candidateColumns(window.start, window.end, exact);

  const profileIds = [...new Set(marketplacePicks.map((p) => p.marketplaceVendorId as string))];
  const availByProfile = profileIds.length
    ? await getBatchVendorAvailableDays(admin, profileIds, window.start, window.end)
    : new Map<string, Set<string>>();

  // Group picks by category, top pick (lowest rank) first.
  const byCategory = new Map<string, SchedulePick[]>();
  for (const p of picks) {
    const cat = p.category ?? 'other';
    const arr = byCategory.get(cat);
    if (arr) arr.push(p);
    else byCategory.set(cat, [p]);
  }
  for (const arr of byCategory.values()) arr.sort((a, b) => a.rank - b.rank);

  const dates: MatrixDate[] = columns.map((dateKey) => {
    const categories: MatrixCategory[] = [];
    for (const [cat, catPicks] of byCategory) {
      const vendors: MatrixVendor[] = catPicks.map((p, i) => {
        let state: MatrixVendorState;
        if (!p.marketplaceVendorId) {
          state = 'unknown';
        } else {
          const avail = availByProfile.get(p.marketplaceVendorId);
          state = avail ? (avail.has(dateKey) ? 'open' : 'booked') : 'open';
        }
        return { key: p.key, name: p.name, isTopPick: i === 0, state };
      });
      const covered = vendors.some((v) => v.state === 'open' || v.state === 'unknown');
      const top = vendors[0];
      const topPickKept = !!top && (top.state === 'open' || top.state === 'unknown');
      categories.push({ category: cat, label: displayServiceLabel(cat), vendors, covered, topPickKept });
    }
    const coveredCount = categories.filter((c) => c.covered).length;
    const topPicksKept = categories.filter((c) => c.topPickKept).length;
    const { label, dow } = labelFor(dateKey);
    return {
      dateKey,
      label,
      dow,
      categories,
      coveredCount,
      totalCategories: categories.length,
      topPicksKept,
      isBest: false,
    };
  });

  // Rank: most categories covered → most top picks kept → earliest date.
  dates.sort(
    (a, b) =>
      b.coveredCount - a.coveredCount ||
      b.topPicksKept - a.topPicksKept ||
      a.dateKey.localeCompare(b.dateKey),
  );
  const best = dates[0];
  if (best && best.totalCategories > 0) best.isBest = true;

  return { hasDate: true, hasShortlist, exactDate: exact, offPlatformCount, dates };
}
