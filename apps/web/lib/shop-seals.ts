/**
 * shop-seals.ts — THE SEALS: who is given which seal, as one rule set. Pure (no Supabase, no Next), so every rule is
 * executed by `lib/shop-seals.test.ts`. The reads and the writer are `lib/shop-seals.server.ts`; the table is
 * `shop_seals` (migration 20271348504364).
 *
 * Contract: the owner-approved prototypes of 15 Nov (DECISION_LOG 7d6c8129) — `badge-milestones_v86` AWARD_TXT — and
 * the rows that rule them: 6373 (Top 10 / No. 1), 4b8cc3a3 (the seals replace the monthly Spotlight awards),
 * 3077c9b3 (Verified Partner, ten rules, for life), 6451 (plaque numbers, Clients' Choice), 50566f42.
 *
 * ── THE SEALS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *   Setnayan Verified   — the shop's own verification, read LIVE (lib/verified-badge.ts). Never stored.
 *   Verified Partner    — ten rules, kept for life, and from then on it REPLACES Setnayan Verified (3077c9b3).
 *   Top 10 Supplier     — yearly: ≥ 10 events completed through Setnayan that year and none cancelled by the shop;
 *                         the ten highest review scores (`topPickScore`, lib/vendor-badges.ts). One list, all services.
 *   No. 1 of the Year   — the first of that Top 10. One shop a year.
 *   Most In-Demand      — yearly: top 10% of suppliers by completed bookings that year; cancelled or refunded ones do
 *                         not count (v86 "crest"). The same top-10% rule as the monthly Most Booked it replaces.
 *   Clients' Choice     — yearly (11d044c0 (2)): the shop with the most SECOND bookings that year, among shops with
 *                         ≥ 10 completed events that year; ties go to the higher rating. One shop.
 *
 * ── THE SEAL YEAR (owner, 11d044c0 (1); amends 6373's "calendar year") ──────────────────────────────────────────
 * The four yearly seals are given on 18 DEC and count 18 Dec last year → 17 Dec this year — a full 12 months, no gap
 * or overlap. The FIRST year runs from launch to 17 Dec 2026. Verified Partner is given the day its rules are met.
 * The Top 10 plaque shows the exact rank: "No. 4 of the Top 10 Suppliers of 2026" (11d044c0 (5)).
 *
 * ── WHAT IS NOT RULED, OR HAS NO DATA TODAY (each a named gap, never an invented number) ─────────────────────────
 *   · "A second booking made that year": a booking carries no booked-at date, so the second booking is placed in the
 *     seal year of its EVENT's date — the same date every yearly count uses (shop_seal_year_facts).
 *   · "Cancelled by the shop": the only RECORDED source is a schedule-pool release `vendor_cancelled`; a couple's
 *     force-majeure flag is a claim, not a record, and is not counted. Bookings outside schedule pools have no
 *     who-cancelled column ⇒ a partial source (SHOP_CANCELLATION_SOURCE).
 *   · The yearly rating: trusted review stats exist for a shop's whole life only, not per year — Top 10 ranks on the
 *     lifetime score, as the monthly Top Pick it replaces does.
 *   · Verified Partner rule 10 (suppliers invited, ruled 7fbff0cd): the supplier-import door is not built, so NO
 *     counter exists ⇒ always "unread" ⇒ never awarded until one does. Rules 9 and 10 live in `PARTNER_RULES_9_AND_10`.
 *   · No. 1's free plan year (7fbff0cd (6)) is given through G3's gift-to-shop flow (#7674, not merged): until then
 *     the seal row records it as owed (`NO1_PLAN_GIFT`).
 *
 * 🔑 A FAILED READ IS NEVER A ZERO. Every count arrives as `number | null`; null makes the rule "unread", and an
 * unread rule never awards — and never reads as "not met" either.
 */
import { MOST_BOOKING_PERCENTILE, topPickScore } from '@/lib/vendor-badges';
import { formatCount } from '@/lib/format-number';

// ── The vocabulary ─────────────────────────────────────────────────────────────────────────────────────────────

/** The seals stored in `shop_seals.seal` (the table's CHECK). Setnayan Verified is never stored. */
export const STORED_SEALS = ['no1', 'top10', 'most_in_demand', 'clients_choice', 'verified_partner'] as const;
export type StoredSeal = (typeof STORED_SEALS)[number];
export type SealKey = StoredSeal | 'verified';

/** The yearly seals — once per shop + seal + year. */
export const YEARLY_SEALS: ReadonlyArray<StoredSeal> = ['no1', 'top10', 'most_in_demand', 'clients_choice'];

/** The names, in the prototype's own words (badge-milestones_v86 AWARD_TXT). */
export const SEAL_LABEL: Record<SealKey, string> = {
  verified: 'Setnayan Verified',
  verified_partner: 'Verified Partner',
  no1: 'No. 1 Supplier of the Year',
  top10: 'Top 10 Supplier',
  most_in_demand: 'Most In-Demand',
  clients_choice: "Clients' Choice",
};

/**
 * The flow order when several are earned together (DECISION_LOG e5ec685d pick (7): "No. 1 → other seals → badges"),
 * and the order a shop's seals are listed in.
 */
export const SEAL_ORDER: ReadonlyArray<SealKey> = ['no1', 'top10', 'clients_choice', 'most_in_demand', 'verified_partner', 'verified'];

/**
 * 🗄 RETIRED AS BADGES (4b8cc3a3): the monthly Spotlight awards the seals replace. Their rows in
 * `vendor_spotlight_awards` stay exactly as they are — history, never dropped, never rewritten.
 */
export const RETIRED_SPOTLIGHT_AWARDS = ['top_pick', 'most_booked', 'rising'] as const;

// ── The gaps, named in one place ───────────────────────────────────────────────────────────────────────────────

/** The first seal year: launch → 17 Dec 2026 (11d044c0 (1)). */
export const FIRST_SEAL_YEAR = 2026;

/** The day the yearly seals are given — and the first day of the next seal year: 18 December (11d044c0 (1)). */
export const SEAL_DAY = { month: 12, day: 18 } as const;

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Seal year `year` = [18 Dec of year−1, 18 Dec of year) — `from` inclusive, `to` exclusive, as DATEs. The first year
 * has no start (`from: null` = from launch).
 */
export function sealWindow(year: number, firstYear: number = FIRST_SEAL_YEAR): { from: string | null; to: string } {
  return {
    from: year <= firstYear ? null : iso(year - 1, SEAL_DAY.month, SEAL_DAY.day),
    to: iso(year, SEAL_DAY.month, SEAL_DAY.day),
  };
}

/** Where "cancelled by the shop" is read from — a PARTIAL source (see the module note). */
export const SHOP_CANCELLATION_SOURCE = "vendor_schedule_pool_bookings.release_reason = 'vendor_cancelled'" as const;

/**
 * 🚫 IMPORTS NEVER COUNT AS COMPLETED BOOKINGS (owner 16 Nov, DECISION_LOG fd5814dc (3); the controller applies it to
 * every badge, seal and Most Booked count). A booking whose `event_vendors.source` is one of these — or onto which a
 * Booking QR token was claimed — is left out of completed events, second bookings and Verified Partner's ₱ total. The
 * SQL definition is `shop_booking_is_import` (migration 20271348504364); this list mirrors it and a test holds them equal.
 * ⚠ Verified Partner rules 4–6 still COUNT the website / QR import / Booking QR channels by name (3077c9b3) — the
 * two rulings overlap there, and the PR names it for the owner.
 */
export const IMPORT_SOURCES = ['vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'website'] as const;

// ── Yearly seals ───────────────────────────────────────────────────────────────────────────────────────────────

/** Top 10 / No. 1: "at least 10 events completed through Setnayan" that year (6373). */
export const TOP10_MIN_EVENTS = 10;
/** "TOP 10 ONLY (no Top 100)" (6372 (9)). */
export const TOP10_SIZE = 10;

/** One shop's year, as `shop_seal_year_facts` returns it, plus its lifetime trusted review stats. */
export type SealYearCandidate = {
  vendorProfileId: string;
  /** The yearly pools are the verified pool — the same as the monthly Spotlight awards these replace. */
  verified: boolean;
  completedEvents: number;
  refundedEvents: number;
  shopCancellations: number;
  inquiries: number;
  /** Clients' second bookings whose event falls in the seal year (shop_seal_year_facts.second_bookings). */
  secondBookings: number;
  trustedAvgRating: number | null;
  trustedReviewCount: number | null;
};

export type RankedShop = { vendorProfileId: string; rank: number; score: number };

/** The ten highest review scores among loved-AND-reliable shops (6373 option B). Ties: more events, then id. */
export function pickTop10(candidates: ReadonlyArray<SealYearCandidate>): RankedShop[] {
  return candidates
    .filter(
      (c) =>
        c.verified &&
        c.completedEvents >= TOP10_MIN_EVENTS &&
        c.shopCancellations === 0 &&
        (c.trustedReviewCount ?? 0) > 0,
    )
    .map((c) => ({ c, score: topPickScore(Number(c.trustedAvgRating ?? 0), c.trustedReviewCount ?? 0) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.c.completedEvents - a.c.completedEvents ||
        a.c.vendorProfileId.localeCompare(b.c.vendorProfileId),
    )
    .slice(0, TOP10_SIZE)
    .map((x, i) => ({ vendorProfileId: x.c.vendorProfileId, rank: i + 1, score: x.score }));
}

/**
 * 🎁 No. 1's prize beyond the seal (7fbff0cd (6)): ONE FREE YEAR of the shop's CURRENT supplier plan, through the
 * existing Setnayan gift-to-shop flow (G3, #7674) — never a new money path. The engine only records it 'owed' on the
 * No. 1 row, with the plan the shop was on when the seal was given; G3's flow gives it and marks it 'given'.
 */
export const NO1_PLAN_GIFT = { months: 12, via: 'G3 gift-to-shop flow (#7674)', recordedAs: 'owed' } as const;

/** No. 1 = the first of the Top 10 (6373). None when the Top 10 is empty. */
export function pickNo1(top10: ReadonlyArray<RankedShop>): RankedShop | null {
  return top10.find((r) => r.rank === 1) ?? null;
}

/** Completed bookings that count for Most In-Demand: refunded ones never count (v86 crest). */
export function inDemandCount(c: SealYearCandidate): number {
  return Math.max(0, c.completedEvents - c.refundedEvents);
}

/**
 * Most In-Demand: the top 10% of verified suppliers by counted completed bookings that year — the threshold is the
 * monthly Most Booked's own (`MOST_BOOKING_PERCENTILE`, the value at index ceil(p·n)−1 of the sorted counts; ties at
 * the threshold all qualify; zero never qualifies).
 */
export function pickMostInDemand(candidates: ReadonlyArray<SealYearCandidate>): string[] {
  const pool = candidates.filter((c) => c.verified);
  if (pool.length === 0) return [];
  const counts = pool.map(inDemandCount).sort((a, b) => a - b);
  const threshold = counts[Math.max(0, Math.ceil(MOST_BOOKING_PERCENTILE * counts.length) - 1)]!;
  return pool
    .filter((c) => inDemandCount(c) > 0 && inDemandCount(c) >= threshold)
    .map((c) => c.vendorProfileId)
    .sort();
}

export type YearlyPicks = {
  top10: RankedShop[];
  no1: RankedShop | null;
  mostInDemand: string[];
  clientsChoice: string | null;
};

/** Clients' Choice needs at least 10 completed events that year (11d044c0 (2)). */
export const CLIENTS_CHOICE_MIN_EVENTS = 10;

/**
 * Clients' Choice (11d044c0 (2)): among verified shops with ≥ 10 completed events that year, the one with the most
 * second bookings; a tie goes to the higher rating (trusted average). A tie on both goes to the stable id — never to
 * chance. Nobody when no eligible shop has a second booking.
 */
export function pickClientsChoice(candidates: ReadonlyArray<SealYearCandidate>): string | null {
  const best = candidates
    .filter((c) => c.verified && c.completedEvents >= CLIENTS_CHOICE_MIN_EVENTS && c.secondBookings > 0)
    .sort(
      (a, b) =>
        b.secondBookings - a.secondBookings ||
        Number(b.trustedAvgRating ?? 0) - Number(a.trustedAvgRating ?? 0) ||
        a.vendorProfileId.localeCompare(b.vendorProfileId),
    )[0];
  return best ? best.vendorProfileId : null;
}

/** The Top 10 plaque's line, with the exact rank (11d044c0 (5)): "No. 4 of the Top 10 Suppliers of 2026". */
export function top10PlaqueLine(rank: number, year: number): string {
  return `No. ${rank} of the Top 10 Suppliers of ${year}`;
}

export function pickYearlySeals(candidates: ReadonlyArray<SealYearCandidate>): YearlyPicks {
  const top10 = pickTop10(candidates);
  return {
    top10,
    no1: pickNo1(top10),
    mostInDemand: pickMostInDemand(candidates),
    clientsChoice: pickClientsChoice(candidates),
  };
}

/** The date in Manila (UTC+8, no daylight saving), as YYYY-MM-DD. */
export function manilaDate(now: Date): string {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** The year in Manila. */
export function manilaYear(now: Date): number {
  return Number(manilaDate(now).slice(0, 4));
}

/**
 * May the seals of seal year `year` be given now? From its 18 December (Manila) on — the day they are given, when the
 * year (ending 17 Dec) is complete — and never for a year before the first.
 */
export function yearlySealsMayRun(
  year: number,
  now: Date,
  firstYear: number = FIRST_SEAL_YEAR,
): { ok: true } | { ok: false; why: string } {
  if (!Number.isInteger(year) || year < firstYear) return { ok: false, why: `${year} is before the first seal year ${firstYear}` };
  if (manilaDate(now) < sealWindow(year, firstYear).to) return { ok: false, why: `the ${year} seal year ends 17 Dec — seals are given from 18 Dec` };
  return { ok: true };
}

// ── Verified Partner — ten rules, for life (3077c9b3) ─────────────────────────────────────────────────────────

/** Everything the ten rules read. Every count is `number | null`: null = the read failed or has no source. */
export type PartnerFacts = {
  verified: boolean | null;
  bookedTotalPhp: number | null;
  findBookings: number | null;
  websiteBookings: number | null;
  qrImportBookings: number | null;
  bookingQrEvents: number | null;
  trustedAvgRating: number | null;
  trustedReviewCount: number | null;
  /** Accepted, active vendor_partnerships recommending the shop (the reading of rule 9). */
  recommenders: number | null;
  /** Counted Invites (the reading of rule 10) — NO SOURCE today, so always null. */
  invites: number | null;
};

export type RuleState = 'met' | 'unmet' | 'unread';

export type PartnerRule = {
  /** The owner's rule number, in his order. */
  n: number;
  key: string;
  /** In the prototype's words (v86 AWARD_TXT.partner.h). */
  label: string;
  check: (f: PartnerFacts) => RuleState;
};

const atLeast = (v: number | null, min: number): RuleState => (v === null ? 'unread' : v >= min ? 'met' : 'unmet');

/**
 * ✅ RULES 9 AND 10, AS RULED (owner 15 Nov, DECISION_LOG 7fbff0cd (1)(2)) — kept in this one list so a later ruling
 * changes them in one place:
 *   9 · "Has 10 suppliers recommending them"  = 10 ACCEPTED, active vendor_partnerships recommending the shop.
 *  10 · "Has invited 10 supplier"              = 10 counted Invites: suppliers the shop imported whose event is
 *                                                 COMPLETED (7fbff0cd (3)). The import door is not built yet, so no
 *                                                 counter exists: this rule reads "unread" ("Not counted yet", 6439 (4)).
 */
export const PARTNER_RULES_9_AND_10: ReadonlyArray<PartnerRule> = [
  { n: 9, key: 'recommend', label: '10 suppliers recommend you', check: (f) => atLeast(f.recommenders, 10) },
  { n: 10, key: 'invite', label: '10 suppliers invited', check: (f) => atLeast(f.invites, 10) },
];

/** ₱1,000,000 in bookings in total (rule 2). */
export const PARTNER_BOOKED_TOTAL_PHP = 1_000_000;
/** Each found-through channel and the Booking QR need 10 (rules 3–6). */
export const PARTNER_CHANNEL_MIN = 10;
/** Rated 4.7 stars or higher (rule 7). */
export const PARTNER_MIN_RATING = 4.7;

/**
 * The ten rules, in the owner's order. Rule 8 ("permanently replaces the verified badge") is not a test — it is what
 * earning does (`displayedSeals`), so it is listed but always met.
 */
export const VERIFIED_PARTNER_RULES: ReadonlyArray<PartnerRule> = [
  { n: 1, key: 'verified', label: 'Setnayan Verified first', check: (f) => (f.verified === null ? 'unread' : f.verified ? 'met' : 'unmet') },
  { n: 2, key: 'booked_total', label: `₱${formatCount(PARTNER_BOOKED_TOTAL_PHP)} in bookings in total`, check: (f) => atLeast(f.bookedTotalPhp, PARTNER_BOOKED_TOTAL_PHP) },
  { n: 3, key: 'find', label: '10 bookings found through Suppliers › Find', check: (f) => atLeast(f.findBookings, PARTNER_CHANNEL_MIN) },
  { n: 4, key: 'website', label: '10 bookings found through your website', check: (f) => atLeast(f.websiteBookings, PARTNER_CHANNEL_MIN) },
  { n: 5, key: 'qr_import', label: '10 bookings found through QR import', check: (f) => atLeast(f.qrImportBookings, PARTNER_CHANNEL_MIN) },
  { n: 6, key: 'booking_qr', label: '10 events booked with your Booking QR', check: (f) => atLeast(f.bookingQrEvents, PARTNER_CHANNEL_MIN) },
  {
    n: 7,
    key: 'rating',
    label: 'Rated 4.7 stars or higher',
    check: (f) =>
      f.trustedAvgRating === null || f.trustedReviewCount === null
        ? 'unread'
        : f.trustedReviewCount > 0 && f.trustedAvgRating >= PARTNER_MIN_RATING
          ? 'met'
          : 'unmet',
  },
  { n: 8, key: 'replaces_verified', label: 'Kept for life: it replaces Setnayan Verified', check: () => 'met' },
  ...PARTNER_RULES_9_AND_10,
];

export type PartnerVerdict = {
  earned: boolean;
  rules: Array<{ n: number; key: string; label: string; state: RuleState }>;
};

/** Earned only when EVERY rule is met. One unread rule ⇒ not earned (and not "unmet" — it says unread). */
export function judgeVerifiedPartner(f: PartnerFacts): PartnerVerdict {
  const rules = VERIFIED_PARTNER_RULES.map((r) => ({ n: r.n, key: r.key, label: r.label, state: r.check(f) }));
  return { earned: rules.every((r) => r.state === 'met'), rules };
}

// ── What a shop wears ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * The seals a shop shows: its stored seals plus Setnayan Verified while it holds the Verified badge — except that a
 * Verified Partner never also shows Setnayan Verified (3077c9b3 rule 8: "permanently replaces"), even if its
 * verification later lapses: the partner seal is kept for life. In SEAL_ORDER, each seal once.
 */
export function displayedSeals(stored: ReadonlyArray<StoredSeal>, holdsVerifiedBadge: boolean): SealKey[] {
  const have = new Set<SealKey>(stored);
  if (holdsVerifiedBadge && !have.has('verified_partner')) have.add('verified');
  return SEAL_ORDER.filter((k) => have.has(k));
}
