/**
 * build-date-window.ts — the PURE core of BUILD-CANDIDATE SCHEDULE CONVERGENCE,
 * the SOFT tier (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §6 decision #12,
 * PR-G1).
 *
 * The owner's sentence: *"when they add someone to the build, the options on
 * the bench change — some become incompatible to the schedules of the service
 * chosen. the goal is to bring everything down to one choice."*
 *
 * So: the build has a **shared-date window** — the intersection of every locked
 * + candidate vendor's declared calendar inside the couple's date-probe window.
 * Every candidate they add narrows it. A bench vendor with no free day left
 * inside that window sinks behind a "Doesn't fit your build" divider with the
 * clashing candidate NAMED, and comes straight back when that candidate is
 * removed. Nothing here writes; nothing here reserves.
 *
 * ## Three rules this module exists to keep honest
 *
 * 1. **FAIL-OPEN, always.** The shipped stance of the whole availability path
 *    (`getBatchVendorAvailableDays`: "a calendar flake reads free, never a false
 *    booked") is preserved here: a vendor with NO calendar signal gets `null` —
 *    never a clash. Absence of data is never evidence against a vendor.
 * 2. **The build's own conflict is never a vendor's fault.** When the window is
 *    already EMPTY (two candidates that never overlap), this module returns NO
 *    per-vendor verdicts at all — sinking the entire bench would blame every
 *    vendor for a problem that lives in the couple's build. The banner says
 *    "swap one" instead. (The playable prototype sinks everything in that state;
 *    with its 3 fixture vendors that reads fine, with a real 40-card bench it is
 *    a dead surface. Deliberate divergence, documented here so it is a decision
 *    and not a drift.)
 * 3. **This tier promises NOTHING about reservations.** It reasons purely over
 *    vendor-declared calendars, which is exactly why PR-G1 was unblocked from
 *    the lock-reserves-date gate that still holds PR-G2 (§6 build-order impact).
 *    Copy in here must never imply a held date.
 *
 * The HARD anchor tier (locked date / venue → red "Booked on your date" /
 * "Beyond reach") is PR-G2 and lives elsewhere. When the couple HAS a committed
 * day-precision date, this module reports `source: 'anchored'` and issues no
 * soft verdicts — the shipped `dateFit` badge already answers that question and
 * a second, softer answer beside it would just be noise.
 */

/** Where the window came from — decides the banner AND whether verdicts fire. */
export type BuildWindowSource =
  /** The couple committed to a day. Soft tier OFF (the anchor tier owns it). */
  | 'anchored'
  /** Nothing in the build has a calendar yet → no constraint, no banner. */
  | 'open'
  /** ≥1 locked/candidate vendor with a calendar constrains the window. */
  | 'build';

/** One locked-or-candidate vendor, as the window reads it. */
export type TeamCalendarMember = {
  /** `event_vendors.vendor_id` — used ONLY to skip self when naming a clash. */
  vendorId: string;
  /** Display name — this is what the amber badge names. */
  name: string;
  /** Day keys (YYYY-MM-DD) this member is free on, already ∩ the probe window. */
  freeDays: ReadonlySet<string>;
};

export type BuildDateWindow = {
  source: BuildWindowSource;
  /** Day keys every member can do, ascending. Empty + 'build' = conflict. */
  dayKeys: string[];
  /** Calendar-bearing members that constrained it (0 ⇒ 'open'). */
  memberCount: number;
  /** Days in the probe window — the denominator behind "N of M". */
  windowSize: number;
  /**
   * Set ONLY when a 'build' window came back empty: the first pair of members
   * that share no free day — the shipped Compare "swap one of these" hint.
   * Null when the emptiness is a 3-way conflict with no guilty pair.
   */
  conflictPair: [string, string] | null;
};

/** The probe window the page reads calendars over. */
export type ProbeWindow = {
  /** TRUE ⇒ the couple committed to a day; the soft tier stands down. */
  anchored: boolean;
  /** The days in play, ascending. For `anchored`, exactly one. */
  dayKeys: string[];
  /** Inclusive range to hand `getBatchVendorAvailableDays` (one read). */
  rangeStart: string;
  rangeEnd: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * "2027-09-12" → "Sep 12". Hardcoded month names on purpose: the label is
 * rendered on the server AND asserted in unit tests, and `toLocaleDateString`
 * would make both depend on the runtime's ICU data.
 */
export function formatDayKeyLabel(key: string): string {
  if (!ISO_DAY.test(key)) return key;
  const [, m, d] = key.split('-');
  const month = MONTH_SHORT[Number(m) - 1];
  if (!month) return key;
  return `${month} ${Number(d)}`;
}

/** Widest probe RANGE we will hand the batched calendar read (see below). */
const MAX_PROBE_SPAN_DAYS = 366;

/** Whole days between two YYYY-MM-DD keys. Local midnight on both ends, so DST
 *  can't shave the difference to a fraction. */
function daysApart(aKey: string, bKey: string): number {
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return 0;
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round(Math.abs(b - a) / 86_400_000);
}

/** Every day key in [start, end] inclusive, ascending. Pure date arithmetic. */
function expandRange(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return out;
  const cursor = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  // Guard against a pathological range blowing the page up.
  let guard = 0;
  while (cursor <= last && guard < 1000) {
    const y = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    const dd = String(cursor.getDate()).padStart(2, '0');
    out.push(`${y}-${mm}-${dd}`);
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return out;
}

/**
 * The window the bench probes calendars over, resolved from what the couple has
 * actually told us. Returns NULL when there is nothing convergeable:
 *
 *  • **day precision** → `anchored`, one day. The anchor tier owns the verdicts.
 *  • **date candidates** (the onboarding shortlist that `/date-selection`
 *    narrows) → exactly those days. This is the case the owner described, and
 *    the one where "bring everything down to one choice" is literally true.
 *  • **month precision, no candidates** → that month's days (≤31). Still
 *    convergeable, just coarser.
 *  • **year precision / no date** → NULL. A 365-day window narrows to ~360 days;
 *    a banner listing them would be noise pretending to be a signal.
 */
export function resolveProbeWindow(args: {
  eventDate: string | null;
  precision: string | null;
  candidates: readonly string[] | null;
}): ProbeWindow | null {
  const { eventDate, precision } = args;

  if (eventDate && ISO_DAY.test(eventDate) && (precision ?? 'day') === 'day') {
    return { anchored: true, dayKeys: [eventDate], rangeStart: eventDate, rangeEnd: eventDate };
  }

  const candidates = [
    ...new Set((args.candidates ?? []).filter((c) => typeof c === 'string' && ISO_DAY.test(c))),
  ].sort();
  if (candidates.length > 0) {
    const first = candidates[0]!;
    const last = candidates[candidates.length - 1]!;
    // The probe RANGE (not the day set) is what the batched calendar read walks
    // day by day, so a pathological candidate span — two dates two years apart —
    // would build a huge per-vendor day set for no gain. Beyond a year it is not
    // a convergeable window anyway; say so instead of doing the work.
    if (daysApart(first, last) > MAX_PROBE_SPAN_DAYS) return null;
    return { anchored: false, dayKeys: candidates, rangeStart: first, rangeEnd: last };
  }

  if (eventDate && precision === 'month') {
    const [y, m] = eventDate.split('-').map(Number);
    if (!y || !m) return null;
    const mm = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${y}-${mm}-01`;
    const end = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
    return { anchored: false, dayKeys: expandRange(start, end), rangeStart: start, rangeEnd: end };
  }

  return null;
}

/**
 * The build's shared-date window: `probe.dayKeys` minus every day any member
 * has blocked. Members with a full free window (an undeclared calendar, or one
 * that read free) simply never subtract anything — that is the fail-open stance,
 * expressed as arithmetic rather than as a special case.
 */
export function resolveBuildDateWindow(args: {
  enabled: boolean;
  probe: ProbeWindow | null;
  members: ReadonlyArray<TeamCalendarMember>;
}): BuildDateWindow | null {
  const { enabled, probe, members } = args;
  if (!enabled || !probe) return null;

  const windowSize = probe.dayKeys.length;
  if (probe.anchored) {
    return {
      source: 'anchored',
      dayKeys: [...probe.dayKeys],
      memberCount: members.length,
      windowSize,
      conflictPair: null,
    };
  }
  if (members.length === 0) {
    return {
      source: 'open',
      dayKeys: [...probe.dayKeys],
      memberCount: 0,
      windowSize,
      conflictPair: null,
    };
  }

  const dayKeys = probe.dayKeys.filter((k) => members.every((m) => m.freeDays.has(k)));

  // Empty intersection → name the first pair that never overlaps, exactly like
  // the shipped `getAvailableDaysForVendorSet` conflict-pair hint the Compare
  // footer already renders. O(n² · days) over ≤ ~20 members.
  let conflictPair: [string, string] | null = null;
  if (dayKeys.length === 0 && members.length >= 2) {
    outer: for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]!;
        const b = members[j]!;
        const shares = probe.dayKeys.some((k) => a.freeDays.has(k) && b.freeDays.has(k));
        if (!shares) {
          conflictPair = [a.name, b.name];
          break outer;
        }
      }
    }
  }

  return { source: 'build', dayKeys, memberCount: members.length, windowSize, conflictPair };
}

/** One bench card's soft verdict. NULL is "no verdict" — never a penalty. */
export type BuildFitVerdict =
  | { fits: true }
  | { fits: false; clashWith: string | null };

/**
 * Does this bench vendor still have a day inside the build's window?
 *
 * Returns NULL — meaning "say nothing, sink nothing, disable nothing" — in
 * every case where a verdict would be a guess:
 *
 *  • the soft tier isn't running (`null` / `'anchored'` / `'open'` window);
 *  • the vendor has no calendar signal (`freeDays === null`: off-platform pick,
 *    or a read the batch helper could not answer);
 *  • the build's own window is already EMPTY (rule 2 in the module docblock —
 *    the fault is the build's, so no vendor gets blamed for it).
 */
export function classifyAgainstBuildWindow(args: {
  window: BuildDateWindow | null;
  /** Day keys this vendor is free on inside the probe window; NULL = no signal. */
  vendorFreeDays: ReadonlySet<string> | null;
  /** `event_vendors.vendor_id` of the card, so a build member never clashes with itself. */
  vendorId: string;
  members: ReadonlyArray<TeamCalendarMember>;
  probeDayKeys: readonly string[];
}): BuildFitVerdict | null {
  const { window: w, vendorFreeDays, vendorId, members, probeDayKeys } = args;
  if (!w || w.source !== 'build') return null;
  if (!vendorFreeDays) return null;
  if (w.dayKeys.length === 0) return null;

  if (w.dayKeys.some((k) => vendorFreeDays.has(k))) return { fits: true };

  // Name the candidate this vendor cannot share a single day with — the reason
  // the badge gives, and the thing the couple can act on (remove it and this
  // card comes straight back). Self-skip: a member never clashes with itself.
  const clash = members.find(
    (m) => m.vendorId !== vendorId && !probeDayKeys.some((k) => m.freeDays.has(k) && vendorFreeDays.has(k)),
  );
  return { fits: false, clashWith: clash?.name ?? null };
}

// ── Copy ─────────────────────────────────────────────────────────────────────
// Kept in this module rather than `explore-info-copy.ts` because every string
// below is a FUNCTION of the window it describes — the §11 rule 3 ban is on
// copy living inline in JSX, and none of it does.

export type ConvergenceBannerTone = 'anchored' | 'narrowing' | 'converged' | 'conflict';

export type ConvergenceBanner = {
  tone: ConvergenceBannerTone;
  headline: string;
  detail: string;
};

/**
 * The banner between the Coverage Strip and the bench. NULL = render nothing
 * (an open window has nothing to report, and an empty rail should not grow a
 * status bar that says "no news").
 */
export function convergenceBanner(
  w: BuildDateWindow | null,
  opts?: { anchoredLabel?: string | null; maxDates?: number },
): ConvergenceBanner | null {
  if (!w) return null;

  if (w.source === 'anchored') {
    const label = opts?.anchoredLabel;
    return {
      tone: 'anchored',
      headline: label ? `Your date is set: ${label}` : 'Your date is set',
      detail: 'Every card below shows whether that vendor is free that day.',
    };
  }

  if (w.source === 'open') return null;

  if (w.dayKeys.length === 0) {
    return {
      tone: 'conflict',
      headline: 'No single date works — swap one',
      detail: w.conflictPair
        ? `${w.conflictPair[0]} and ${w.conflictPair[1]} share no free day in the dates you are considering. Drop one of them from your build and the rest of your team lines up again.`
        : 'Your build no longer has a day everyone can do. Remove a candidate and the shared dates come back.',
    };
  }

  if (w.dayKeys.length === 1) {
    return {
      tone: 'converged',
      headline: `Only ${formatDayKeyLabel(w.dayKeys[0]!)} works for everyone`,
      detail:
        'Every vendor in your build is free that day. Nothing is held yet — a date is only reserved once a vendor accepts your payment.',
    };
  }

  const max = opts?.maxDates ?? 6;
  const shown = w.dayKeys.slice(0, max).map(formatDayKeyLabel).join(' · ');
  const rest = w.dayKeys.length - Math.min(max, w.dayKeys.length);
  return {
    tone: 'narrowing',
    headline: `Your build's shared dates: ${shown}${rest > 0 ? ` +${rest} more` : ''}`,
    detail: 'Each vendor you add to your build narrows this, until one day fits everyone.',
  };
}

/** The amber badge on a sunk card. */
export function noSharedDateBadge(clashWith: string | null): string {
  return clashWith ? `No shared date with ${clashWith}` : 'No shared date with your build';
}

/** The divider the sunk cards sit behind (spec §6 · prototype). */
export const DOESNT_FIT_DIVIDER = "Doesn't fit your build";

/** The disabled build/lock control's label on a sunk card. */
export const DOESNT_FIT_ACTION = "Doesn't fit your build";

/** Why the actions are off — reversibility is the point, so say it. */
export function doesntFitReason(clashWith: string | null): string {
  return clashWith
    ? `Remove ${clashWith} from your build and this vendor is bookable again.`
    : 'Remove a candidate from your build and this vendor is bookable again.';
}

/**
 * The tiny mono "Free: …" line on a card.
 *
 *  • `freeDays === null` (no signal) → NULL. Nothing is claimed about a vendor
 *    whose calendar we could not read.
 *  • `freeDays === []` → NULL. The amber badge already says it; a "Free:" line
 *    with nothing after it reads like a rendering bug.
 *  • Discrete window (a handful of candidate dates) → name them.
 *  • Wide window (a whole month) → a count, because 28 date chips on a 206px
 *    card is not information.
 */
export function freeDaysLine(args: {
  freeDays: readonly string[] | null;
  windowSize: number;
  maxNames?: number;
}): string | null {
  const { freeDays, windowSize } = args;
  if (!freeDays || freeDays.length === 0) return null;
  const maxNames = args.maxNames ?? 3;
  if (windowSize > 8) return `Free ${freeDays.length} of ${windowSize} days`;
  const shown = freeDays.slice(0, maxNames).map(formatDayKeyLabel).join(' · ');
  const rest = freeDays.length - Math.min(maxNames, freeDays.length);
  return `Free: ${shown}${rest > 0 ? ` +${rest} more` : ''}`;
}

/**
 * Stable partition of a rail into cards that fit and cards that do not. Stable
 * on purpose: the sink must not reshuffle the couple's chosen sort, it must only
 * move the losers to the end (same discipline as the shipped compatible-first
 * partition at `category-search.ts:1099`).
 */
export function partitionByBuildFit<T>(
  rows: readonly T[],
  verdictOf: (row: T) => BuildFitVerdict | null,
): { fits: T[]; clashes: T[] } {
  const fits: T[] = [];
  const clashes: T[] = [];
  for (const row of rows) {
    const v = verdictOf(row);
    if (v && v.fits === false) clashes.push(row);
    else fits.push(row);
  }
  return { fits, clashes };
}
