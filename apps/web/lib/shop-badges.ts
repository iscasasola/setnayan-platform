/**
 * 🏅 A SHOP'S BADGES — the ones that ALREADY compute live, worn as the approved pill (owner 2026-10-28:
 * *"verified pill is good"* · *"we also have badges created based on their performance, remember? we can add this on
 * their tarps? but we want to build it now so it improves everytime"*; corpus DECISION_LOG "THE VERIFIED PILL IS
 * APPROVED — AND THE PERFORMANCE BADGES WEAR IT", prototype `prototypes/calling_cards_20_2026-10-28/pill.html`).
 *
 * 🔑 NO NEW RULE AND NO NEW NUMBER LIVES HERE. Every badge is a fact some shipped rule already decides:
 *
 *   · Verified   — `hasVerifiedBadge` (lib/verified-badge.ts): verified AND its papers deadline not passed. The caller
 *                  hands in the answer; this file never re-asks `verification_state`.
 *   · Milestone  — `milestonesFor` / `MILESTONE_THRESHOLDS` 10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000
 *                  (lib/service-card-record.ts, the ladder changed 2026-10-28), applied
 *                  to the shop's PUBLIC completed-events count (`vendor_public_completed_events_stats`, the same
 *                  anti-fraud number the shop page's experience chip states). A pure function of that count, NEVER
 *                  stored: a booking that is voided leaves `delivered/complete`, the view refreshes, and the medal is
 *                  un-earned on the next read. Nothing to revoke.
 *   · ★ Rating   — the TRUSTED aggregate only (`cardRecordRatingFromTrusted`: count > 0 AND avg > 0). No reviews = no
 *                  badge — never a 0.0. And NO target: no ruling sets a rating goal (owner: "don't guess"), so the
 *                  tracker shows the live ★ and nothing to reach for.
 *   · Years      — `yearsInBusiness` (lib/vendor-experience.ts): null below one year, so a first-year shop shows none.
 *   · Awards     — the shop's current Spotlight Awards, in their `AWARD_LABELS` words (the Today Shop row's
 *                  `awardWord`) — the monthly marketplace recognitions that already ship.
 *
 * A milestone wears its step's material
 * (`lib/badge-tiers.ts`), so the badge looks better the higher the step.
 *
 * PURE — no clock (the year is handed in), no network, no `server-only`. The readers live in `shop-badges.server.ts`;
 * every surface (the shop's page, Shop › Page, Today, the print file) composes from THIS file, so a badge cannot read
 * one thing on the tarp and another on the page.
 */

import { cardRecordRatingFromTrusted, milestonesFor } from '@/lib/service-card-record';
import { yearsInBusiness } from '@/lib/vendor-experience';
import { stepGlyph, tierForStep, type TierKey } from '@/lib/badge-tiers';

export type ShopBadgeKind = 'verified' | 'milestone' | 'rating' | 'years' | 'award';

/** One badge, ready to draw as the pill: the circle (the mark when `glyph` is null) and two tracked lines. */
export type ShopBadge = {
  /** Stable id — `verified` · `milestone:50` · `rating` · `years` · `award:<words>`. Also the print file's `badge=`. */
  key: string;
  kind: ShopBadgeKind;
  /** What sits in the circle; null = the official SETNAYAN mark. */
  glyph: string | null;
  line1: string;
  line2: string;
  /** The badge in plain words, for a screen reader and the Today line. */
  label: string;
  /** A milestone's material (`lib/badge-tiers.ts`) — internal key, never shown. Absent = the plain gold-edged pill. */
  tier?: TierKey;
};

/** What the badges are worked out from — every field a read the caller already made. */
export type ShopBadgeFacts = {
  /** `hasVerifiedBadge(...)` — the one predicate. */
  verified: boolean;
  /** The shop's public completed-events count; null = it could not be read (then no medal is claimed either way). */
  completedEvents: number | null;
  /** `vendor_trusted_review_stats`, as read; null = not read. */
  trusted: { trusted_avg_rating: number | null; trusted_review_count: number | null } | null;
  /** `vendor_profiles.in_business_since_year`. */
  inBusinessSinceYear: number | null;
  /** This month's Spotlight Awards in their `AWARD_LABELS` words ("Setnayan's Top Pick" · "Most Booked" · …). */
  awards: readonly string[];
  /** The calendar year "now" — handed in, so this stays pure. */
  nowYear: number;
};

const VERIFIED: ShopBadge = {
  key: 'verified',
  kind: 'verified',
  glyph: null,
  line1: 'SETNAYAN',
  line2: 'VERIFIED ✓',
  label: 'SETNAYAN Verified',
};

/** The verified pill alone — the shop page's gate decides whether it is drawn. */
export function verifiedBadge(): ShopBadge {
  return VERIFIED;
}

/** The milestone ladder for a count: the highest medal earned, the next one, and how far. */
export type MilestoneLadder = {
  count: number;
  /** The highest threshold reached, or null below the first. */
  earned: number | null;
  /** The next threshold, or null once the top of the ladder is passed. */
  next: number | null;
  /** `next - count`, or null at the top. */
  toGo: number | null;
  /** count / next, 0–100, for the bar; 100 at the top. */
  pct: number;
};

export function milestoneLadder(count: number): MilestoneLadder {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const { earned, next } = milestonesFor(n);
  const top = earned.length > 0 ? earned[earned.length - 1]! : null;
  return {
    count: n,
    earned: top,
    next,
    toGo: next === null ? null : next - n,
    pct: next === null ? 100 : Math.max(0, Math.min(100, (n / next) * 100)),
  };
}

const COUNT = new Intl.NumberFormat('en-PH');

/** The step's approved name (owner 2026-10-28) — "Silver" — or null for a number that is not a step. */
export function stepName(t: number): string | null {
  return tierForStep(t)?.name ?? null;
}

function milestoneBadge(t: number): ShopBadge {
  const name = stepName(t);
  return {
    key: `milestone:${t}`,
    kind: 'milestone',
    glyph: stepGlyph(t),
    line1: `${COUNT.format(t)} EVENTS`,
    // The material's name sits under the number (owner 2026-10-28: "show them on the badge, under the number").
    line2: name ? `${name.toUpperCase()} · ON SETNAYAN` : 'ON SETNAYAN',
    label: `${COUNT.format(t)} events on Setnayan${name ? ` · ${name}` : ''}`,
    tier: tierForStep(t)?.key,
  };
}

/** The words an award wears on the pill: "Setnayan's Top Pick" → SETNAYAN / TOP PICK; "Most Booked" → SETNAYAN / MOST BOOKED. */
function awardBadge(words: string): ShopBadge {
  const rest = words.replace(/^Setnayan[’']s\s+/i, '').trim();
  return { key: `award:${rest.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, kind: 'award', glyph: null, line1: 'SETNAYAN', line2: rest.toUpperCase(), label: words };
}

function ratingWord(avg: number): string {
  return avg.toFixed(1);
}

/**
 * Every badge the shop wears TODAY, in the order they are drawn and printed: Verified · the highest milestone · ★ ·
 * years · awards. A badge whose fact is missing or unread is simply absent — never a zero, never a guess.
 */
export function shopBadges(f: ShopBadgeFacts): ShopBadge[] {
  const out: ShopBadge[] = [];
  if (f.verified) out.push(VERIFIED);
  if (f.completedEvents !== null) {
    const top = milestoneLadder(f.completedEvents).earned;
    if (top !== null) out.push(milestoneBadge(top));
  }
  const rating = cardRecordRatingFromTrusted(f.trusted);
  if (rating) {
    out.push({
      key: 'rating',
      kind: 'rating',
      glyph: '★',
      line1: `${ratingWord(rating.avg)} STARS`,
      line2: `${rating.count} REVIEW${rating.count === 1 ? '' : 'S'}`,
      label: `${ratingWord(rating.avg)} stars from ${rating.count} review${rating.count === 1 ? '' : 's'}`,
    });
  }
  const years = yearsInBusiness(f.inBusinessSinceYear, f.nowYear);
  if (years !== null) {
    out.push({ key: 'years', kind: 'years', glyph: String(years), line1: years === 1 ? 'YEAR' : 'YEARS', line2: 'IN BUSINESS', label: `${years} year${years === 1 ? '' : 's'} in business` });
  }
  for (const a of new Set(f.awards)) if (a.trim()) out.push(awardBadge(a));
  return out;
}

/**
 * 🖨 THE PRINT PIPELINE'S ONE QUESTION — what goes on a card or a tarp. The print renderers call this with facts READ
 * AT PRINT TIME (`readShopBadgeFacts`), never with a value saved when the design was made: a medal un-earned since
 * then is not printed, and one earned since is. The QR on that print lands on the shop's page, which draws
 * `shopBadges` from today's reads — so the scan always shows today's badges.
 */
export function badgesForPrint(shop: ShopBadgeFacts): ShopBadge[] {
  return shopBadges(shop);
}

/* ── The tracker (Shop › Page › Awards and badges) ─────────────────────────────────────────────────────────── */

export type TrackerState = 'earned' | 'to_go' | 'live' | 'not_yet' | 'unread';

export type TrackerRow = {
  kind: ShopBadgeKind;
  key: string;
  /** The circle. */
  badge: ShopBadge;
  title: string;
  line: string;
  state: TrackerState;
  /** The state chip's words: Earned · 4 to go · Live · Not yet · Couldn't load. */
  stateWord: string;
  /** 0–100 — ONLY where a ladder exists (the milestone, and an earned badge at 100). Absent = no bar. */
  bar?: number;
  /** The one action that moves it, in place or one door away. */
  door?: { label: string; href: string };
  /** A ladder badge: the pill it wears now and the pill the next step wears (the material climbs). */
  ladder?: { now: ShopBadge | null; next: ShopBadge | null };
};

/** Where the tracker's doors go — the shipped pages, never a new one. */
export const TRACKER_DOORS = {
  /** Customers › People filtered to "Waiting on you" — the couples asking now. */
  asking: '/vendor-dashboard/customers?lane=waiting#customers',
  /** Customers › People filtered to "Done" — the couples whose day is finished, each with their chat. */
  finished: '/vendor-dashboard/customers?lane=finished#customers',
  verify: '/vendor-dashboard/verify',
  details: '/vendor-dashboard/profile',
} as const;

export type TrackerFacts = ShopBadgeFacts & {
  /** Couples whose finished event has no review from them yet; null = not read. */
  unreviewed: number | null;
};

/**
 * One row per badge with its state, the bar where a ladder exists, and the action that moves it (owner 2026-10-28:
 * *"so we want to show the badge tracker also? so they know what to accomplish to get the next badge"*).
 * ⚠ Rating has NO bar and NO goal — no ruling sets one.
 */
export function badgeTracker(f: TrackerFacts): TrackerRow[] {
  const rows: TrackerRow[] = [];

  rows.push(
    f.verified
      ? { kind: 'verified', key: 'verified', badge: VERIFIED, title: 'SETNAYAN Verified', line: 'Earned · documents approved', state: 'earned', stateWord: 'Earned', bar: 100 }
      : {
          kind: 'verified',
          key: 'verified',
          badge: VERIFIED,
          title: 'SETNAYAN Verified',
          line: 'Setnayan checks your documents',
          state: 'not_yet',
          stateWord: 'Not yet',
          door: { label: 'Send your documents', href: TRACKER_DOORS.verify },
        },
  );

  if (f.completedEvents === null) {
    rows.push({ kind: 'milestone', key: 'milestone', badge: milestoneBadge(10), title: 'Milestone · events on Setnayan', line: 'Your events couldn’t be counted just now', state: 'unread', stateWord: 'Couldn’t load' });
  } else {
    const l = milestoneLadder(f.completedEvents);
    const badge = milestoneBadge(l.earned ?? l.next ?? 10);
    rows.push(
      l.next === null
        ? { kind: 'milestone', key: badge.key, badge, title: 'Milestone · events on Setnayan', line: `${COUNT.format(l.count)} events · every milestone earned`, state: 'earned', stateWord: 'Earned', bar: 100, ladder: { now: badge, next: null } }
        : {
            kind: 'milestone',
            key: badge.key,
            badge,
            title: 'Milestone · events on Setnayan',
            line: `${COUNT.format(l.count)} of ${COUNT.format(l.next)} → next badge: ${COUNT.format(l.next)} events · ${stepName(l.next)}`,
            state: 'to_go',
            stateWord: `${COUNT.format(l.toGo!)} to go`,
            bar: l.pct,
            door: { label: 'See the couples asking', href: TRACKER_DOORS.asking },
            ladder: { now: l.earned === null ? null : milestoneBadge(l.earned), next: milestoneBadge(l.next) },
          },
    );
  }

  const rating = cardRecordRatingFromTrusted(f.trusted);
  const askLine = f.unreviewed && f.unreviewed > 0 ? ` · ${f.unreviewed} couple${f.unreviewed === 1 ? '' : 's'} haven’t reviewed yet` : '';
  const ask = f.unreviewed && f.unreviewed > 0 ? { label: 'Ask for reviews', href: TRACKER_DOORS.finished } : undefined;
  const ratingBadge: ShopBadge = { key: 'rating', kind: 'rating', glyph: '★', line1: 'RATING', line2: 'TRUSTED', label: 'Rating' };
  rows.push(
    f.trusted === null
      ? { kind: 'rating', key: 'rating', badge: ratingBadge, title: 'Rating · trusted reviews', line: 'Your reviews couldn’t be read just now', state: 'unread', stateWord: 'Couldn’t load' }
      : rating
        ? { kind: 'rating', key: 'rating', badge: ratingBadge, title: 'Rating · trusted reviews', line: `★ ${ratingWord(rating.avg)} from ${rating.count}${askLine}`, state: 'live', stateWord: 'Live', door: ask }
        : { kind: 'rating', key: 'rating', badge: ratingBadge, title: 'Rating · trusted reviews', line: `No reviews yet${askLine}`, state: 'not_yet', stateWord: 'Not yet', door: ask },
  );

  const years = yearsInBusiness(f.inBusinessSinceYear, f.nowYear);
  const yearsBadge: ShopBadge = { key: 'years', kind: 'years', glyph: years === null ? '—' : String(years), line1: 'YEARS', line2: 'IN BUSINESS', label: 'Years in business' };
  rows.push(
    years !== null
      ? { kind: 'years', key: 'years', badge: yearsBadge, title: 'Years in business', line: `Since ${f.inBusinessSinceYear} · grows by itself each year`, state: 'earned', stateWord: 'Earned', bar: 100 }
      : f.inBusinessSinceYear
        ? { kind: 'years', key: 'years', badge: yearsBadge, title: 'Years in business', line: `Since ${f.inBusinessSinceYear} · shows after your first year`, state: 'not_yet', stateWord: 'Not yet' }
        : { kind: 'years', key: 'years', badge: yearsBadge, title: 'Years in business', line: 'Add the year you started', state: 'not_yet', stateWord: 'Not yet', door: { label: 'Add it in your details', href: TRACKER_DOORS.details } },
  );
  for (const a of new Set(f.awards)) {
    if (!a.trim()) continue;
    const badge = awardBadge(a);
    rows.push({ kind: 'award', key: badge.key, badge, title: a, line: 'This month', state: 'earned', stateWord: 'Earned', bar: 100 });
  }
  return rows;
}

/** The fold's one-line summary: "Verified · 50 events · ★ 4.8 · next: 100 events". */
export function trackerSummary(f: ShopBadgeFacts): string {
  const parts: string[] = [];
  if (f.verified) parts.push('Verified');
  const l = f.completedEvents === null ? null : milestoneLadder(f.completedEvents);
  if (l?.earned) parts.push(`${COUNT.format(l.earned)} events`);
  const rating = cardRecordRatingFromTrusted(f.trusted);
  if (rating) parts.push(`★ ${ratingWord(rating.avg)}`);
  if (l && l.next !== null) parts.push(`next: ${COUNT.format(l.next)} events`);
  return parts.length > 0 ? parts.join(' · ') : 'They show by themselves as you earn them';
}

/** "Next to earn: 100 events · Gold · 4 to go" — from the same ladder; null at the top or when unread. */
export function nextToEarnLine(completedEvents: number | null): string | null {
  if (completedEvents === null) return null;
  const l = milestoneLadder(completedEvents);
  return l.next === null ? null : `Next to earn: ${COUNT.format(l.next)} events · ${stepName(l.next)} · ${COUNT.format(l.toGo!)} to go`;
}

/* ── "Improves every time" — the Today line ──────────────────────────────────────────────────────────────── */

/**
 * The badges that are EARNED rather than live: Verified, each milestone rung reached, each award. A rating moves both
 * ways and years grow by themselves, so neither is announced as "earned".
 */
export function earnedKeys(f: ShopBadgeFacts): string[] {
  const keys: string[] = [];
  if (f.verified) keys.push('verified');
  if (f.completedEvents !== null) for (const t of milestonesFor(f.completedEvents).earned) keys.push(`milestone:${t}`);
  for (const a of new Set(f.awards)) if (a.trim()) keys.push(awardBadge(a).key);
  return keys;
}

export type EarnedNews = { key: string; badge: ShopBadge; sentence: string; keys: string[] };

/**
 * The ONE thing to say on Today: the newest earned badge the supplier has not yet dismissed — the highest milestone
 * first, then an award, then Verified. Null when nothing is new. `seen` is what they dismissed last time; dismissing
 * stores `keys` (every badge earned now), so the line comes back only when something new is earned.
 *
 * ⚠ No "within reach" line: the ladder has no rule for how close counts as close, and inventing one is a guessed
 * number (owner: "don't guess"). Only "earned" is said.
 */
export function newlyEarned(f: ShopBadgeFacts, seen: readonly string[]): EarnedNews | null {
  const keys = earnedKeys(f);
  const fresh = keys.filter((k) => !seen.includes(k));
  if (fresh.length === 0) return null;
  const milestone = fresh
    .filter((k) => k.startsWith('milestone:'))
    .map((k) => Number(k.slice('milestone:'.length)))
    .sort((a, b) => b - a)[0];
  const award = fresh.find((k) => k.startsWith('award:'));
  const badge =
    milestone !== undefined
      ? milestoneBadge(milestone)
      : award
        ? (shopBadges(f).find((b) => b.key === award) ?? VERIFIED)
        : VERIFIED;
  const what = badge.kind === 'milestone' ? `${COUNT.format(milestone!)} events · ${stepName(milestone!)}` : badge.label;
  return { key: badge.key, badge, sentence: `You earned ${what} ✓ — your tarp and card can show it`, keys };
}
