/**
 * 🏅🎁 BADGE REWARDS — THE ONE TABLE (owner 2026-11-05, DECISION_LOG "BADGE REWARDS — WHAT EACH BADGE GIVES, WHERE IT
 * LANDS, AND THE NEXT ONE SHOWN"; the aim behind every reward, same day: *"our goal is that the suppliers and
 * coordinators give as much inapp service as they can to the guest so we get automatic sales"*).
 *
 * The badge page and the granting BOTH read `BADGE_REWARDS` — so what a row promises is what is paid.
 *
 *   Verified (once) → 1 × Papic 150          · Firsts: first booking through Setnayan → 1 × Papic 150
 *   1st Pick, per LADDER STEP (never per booking): 1·5·10 → Papic 150 · 25·50 → 2 × Papic 150 · 100·250 → Event Plus
 *   Reviews, each step → Papic 150           · Booked Loop → Event Plus (each step of its ladder — see the note there)
 *   Branches, each new branch → Papic 150    · Service cards → Papic 150 when a card gets its FIRST booking
 *   Inspiration box → Papic 150, top steps only
 *   Monthly awards, once per award per month: Most Booked → Event Plus · Top Pick → Event Plus · Rising → 2 × Papic 150
 *   Events on Setnayan: 10 → 2 × Papic 150 · 50 → Event Plus · 100 → 2 × Event Plus · 500 → Event Pro ·
 *                       1,000 · 5,000 · 10,000 → a FREE BOOKING FEE on the next customer (one booking each)
 *   No reward: Years in business · Rating · Plan / Founding / Member since · Yearly awards.
 *
 * 🔑 NO PRICE AND NO PACK SIZE LIVES HERE. "Papic 150" is the SMALLEST Papic pack on the live catalogue
 * (`alwaysAllowedPack`, `lib/shop-gifts.ts`) — its credits and its title are read when a reward is granted or drawn,
 * never typed. A reward is a COUNT of packs / unlocks / free fees.
 *
 * 🔑 EXACTLY ONCE: every reward has a KEY naming its badge and its step or period (`rewardKey`). The database holds
 * the key UNIQUE per shop (`shop_badge_rewards_once`), so a re-run, or a badge lost and earned again, never pays twice.
 *
 * 🔑 MEASURED OR NOT AT ALL: `measured: false` badges have no counter in the code yet. Their rows and their rewards
 * are drawn (owner: "wire the reward table and the UI for them anyway"), and NOTHING is granted for them — the facts
 * that would count them are not in `BadgeRewardFacts`, so no count can be faked.
 *
 * PURE — no I/O, no clock, no `server-only`. Reads and grants: `lib/badge-rewards.server.ts`.
 */

import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { stepName, type ShopBadge, type TrackerRow } from '@/lib/shop-badges';
import type { SpotlightAwardType } from '@/lib/spotlight-awards';

/** What a reward is: gift-stock packs / unlocks, or a free booking fee. */
export type BadgeRewardKind = 'papic' | 'event_plus' | 'event_pro' | 'fee_waiver';

/** A reward: how many of one kind ("2 × Papic 150" = { papic, 2 }). */
export type BadgeReward = { kind: BadgeRewardKind; units: number };

const papic = (units = 1): BadgeReward => ({ kind: 'papic', units });
const plus = (units = 1): BadgeReward => ({ kind: 'event_plus', units });
const pro = (units = 1): BadgeReward => ({ kind: 'event_pro', units });
const freeFee = (): BadgeReward => ({ kind: 'fee_waiver', units: 1 });

/** The badges that pay a reward. */
export type RewardBadge =
  | 'verified'
  | 'first_booking'
  | 'events'
  | 'reviews'
  | 'first_pick'
  | 'booked_loop'
  | 'branches'
  | 'service_cards'
  | 'inspiration'
  | 'award';

/** One step of a counted badge, and what reaching it pays (null = the step pays nothing). */
export type RewardStep = { step: number; reward: BadgeReward | null };

type Base = {
  badge: RewardBadge;
  title: string;
  /** False ⇒ no counter exists in the code yet: drawn, never granted. */
  measured: boolean;
};

export type BadgeRewardRule =
  | (Base & { shape: 'once'; reward: BadgeReward })
  | (Base & { shape: 'ladder'; unit: readonly [singular: string, plural: string]; steps: readonly RewardStep[] })
  /** One reward per new thing (a branch; a card's first booking). */
  | (Base & { shape: 'each'; reward: BadgeReward; eachWord: string })
  | (Base & { shape: 'period'; rewards: Readonly<Record<SpotlightAwardType, BadgeReward>> });

/** Events on Setnayan — keyed by the SHIPPED ladder (`MILESTONE_THRESHOLDS`), so a step can never lose its reward. */
export const EVENTS_STEP_REWARDS: Readonly<Record<number, BadgeReward>> = {
  10: papic(2),
  50: plus(1),
  100: plus(2),
  500: pro(1),
  1000: freeFee(),
  5000: freeFee(),
  10000: freeFee(),
};

/**
 * Reviews' steps — the spec's list (`SUPPLIER_BADGES_AND_AWARDS_2026-11-03.md` §B). ⚖ Owner ruled 2026-11-05 (on the
 * draft PR): these steps, each paying Papic 150.
 */
export const REVIEW_STEPS: readonly number[] = [5, 10, 25, 50, 100, 250, 500];

/** 1st Pick and Booked Loop share the spec's ladder (§B). */
const LOOP_LADDER: readonly number[] = [1, 5, 10, 25, 50, 100, 250];

/** Inspiration box's steps (spec §B). */
export const INSPIRATION_STEPS: readonly number[] = [10, 25, 50, 100, 250];
/**
 * "Papic 150, top steps only" — the TOP TWO steps (100 · 250 photos). ⚖ Owner ruled 2026-11-05 (on the draft PR).
 * Pays nothing until the badge has a counter.
 */
export const INSPIRATION_REWARD_STEPS: readonly number[] = INSPIRATION_STEPS.slice(-2);

export const BADGE_REWARDS: Readonly<Record<RewardBadge, BadgeRewardRule>> = {
  verified: { badge: 'verified', title: 'SETNAYAN Verified', measured: true, shape: 'once', reward: papic(1) },
  first_booking: { badge: 'first_booking', title: 'First booking', measured: true, shape: 'once', reward: papic(1) },
  events: {
    badge: 'events',
    title: 'Milestone · events on Setnayan',
    measured: true,
    shape: 'ladder',
    unit: ['event', 'events'],
    steps: MILESTONE_THRESHOLDS.map((step) => ({ step, reward: EVENTS_STEP_REWARDS[step] ?? null })),
  },
  reviews: {
    badge: 'reviews',
    title: 'Reviews',
    measured: true,
    shape: 'ladder',
    unit: ['review', 'reviews'],
    steps: REVIEW_STEPS.map((step) => ({ step, reward: papic(1) })),
  },
  first_pick: {
    badge: 'first_pick',
    title: '1st Pick',
    measured: false,
    shape: 'ladder',
    unit: ['booking', 'bookings'],
    steps: [
      { step: 1, reward: papic(1) },
      { step: 5, reward: papic(1) },
      { step: 10, reward: papic(1) },
      { step: 25, reward: papic(2) },
      { step: 50, reward: papic(2) },
      { step: 100, reward: plus(1) },
      { step: 250, reward: plus(1) },
    ],
  },
  /**
   * "Booked Loop → Event Plus" at EVERY step of its ladder. ⚖ Owner ruled 2026-11-05 (on the draft PR). Pays nothing
   * until the badge has a counter.
   */
  booked_loop: {
    badge: 'booked_loop',
    title: 'Booked Loop',
    measured: false,
    shape: 'ladder',
    unit: ['family who came back', 'families who came back'],
    steps: LOOP_LADDER.map((step) => ({ step, reward: plus(1) })),
  },
  branches: { badge: 'branches', title: 'Branches', measured: true, shape: 'each', reward: papic(1), eachWord: 'Each new branch' },
  service_cards: {
    badge: 'service_cards',
    title: 'Service cards',
    measured: true,
    shape: 'each',
    reward: papic(1),
    eachWord: 'Each card’s first booking',
  },
  inspiration: {
    badge: 'inspiration',
    title: 'Inspiration box',
    measured: false,
    shape: 'ladder',
    unit: ['photo', 'photos'],
    steps: INSPIRATION_STEPS.map((step) => ({ step, reward: INSPIRATION_REWARD_STEPS.includes(step) ? papic(1) : null })),
  },
  award: {
    badge: 'award',
    title: 'Monthly awards',
    measured: true,
    shape: 'period',
    rewards: { most_booked: plus(1), top_pick: plus(1), rising: papic(2) },
  },
};

/** Badges the owner ruled pay NOTHING (so a row for them says nothing about rewards). */
export const NO_REWARD_BADGES: readonly string[] = ['years', 'rating', 'plan', 'founding', 'member_since', 'yearly_award'];

/**
 * Plan gifts (DECISION_LOG 2026-11-04 "ULTRA = ₱5,990…"): Pro 2 × Papic 150 and Ultra 6 × Papic 150 every 4 weeks.
 * ⚖ NOT GRANTED HERE — owner ruled 2026-11-05: build them later, as their OWN kind. Plan gifts lapse at the end of
 * each 4 weeks (4 Nov ruling); badge rewards never expire. Kept apart so neither rule breaks the other. The numbers sit
 * here so they have one home.
 */
export const PLAN_PERIOD_GIFTS: Readonly<Record<'pro' | 'enterprise', BadgeReward>> = { pro: papic(2), enterprise: papic(6) };

/* ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The exactly-once key: `verified` · `events:50` · `award:rising:2026-11-01` · `branch:<id>` · `card:<id>`. */
export function rewardKey(badge: RewardBadge, part?: string | number): string {
  if (badge === 'branches') return `branch:${part}`;
  if (badge === 'service_cards') return `card:${part}`;
  return part === undefined ? badge : `${badge}:${part}`;
}

/* ── what a shop is owed ──────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the shop's badges measure today. `null` = the read failed or the badge has no counter: NOTHING is granted for
 * it (never a zero, never a guess). 1st Pick, Booked Loop and the Inspiration box are deliberately absent — no
 * counter exists for them in the code.
 */
export type BadgeRewardFacts = {
  verified: boolean | null;
  /** The public completed-events count (`vendor_public_completed_events_stats`) — the milestone's own number. */
  completedEvents: number | null;
  /** Trusted reviews from booked couples (`vendor_trusted_review_stats`). */
  trustedReviews: number | null;
  /** The shop holds at least one Setnayan-sourced booking (`booking_fee_ledger` attribution 'sourced'). */
  firstSourcedBooking: boolean | null;
  /** Paid, live branches (`fetchPublicVendorBranches`). */
  branchIds: readonly string[] | null;
  /** Service cards that have had a Setnayan-sourced booking. */
  bookedCardIds: readonly string[] | null;
  /** Every Spotlight Award the shop has been given (`vendor_spotlight_awards`). */
  awards: ReadonlyArray<{ type: SpotlightAwardType; periodMonth: string }> | null;
};

export type OwedReward = { key: string; badge: RewardBadge; reward: BadgeReward; note: string };

const COUNT = new Intl.NumberFormat('en-PH');

function ladderOwed(badge: RewardBadge, count: number | null, note: (step: number) => string): OwedReward[] {
  const rule = BADGE_REWARDS[badge];
  if (rule.shape !== 'ladder' || !rule.measured || count === null || !Number.isFinite(count)) return [];
  return rule.steps
    .filter((s) => s.reward && s.step <= count)
    .map((s) => ({ key: rewardKey(badge, s.step), badge, reward: s.reward!, note: note(s.step) }));
}

/** Every reward the shop's MEASURED badges have earned, each with its exactly-once key. Granted already or not. */
export function rewardsOwed(f: BadgeRewardFacts): OwedReward[] {
  const out: OwedReward[] = [];
  if (f.verified === true) out.push({ key: rewardKey('verified'), badge: 'verified', reward: papic(1), note: 'Badge reward · SETNAYAN Verified' });
  if (f.firstSourcedBooking === true) {
    out.push({ key: rewardKey('first_booking'), badge: 'first_booking', reward: papic(1), note: 'Badge reward · first booking through Setnayan' });
  }
  out.push(
    ...ladderOwed('events', f.completedEvents, (s) => `Badge reward · ${COUNT.format(s)} events${stepName(s) ? ` · ${stepName(s)}` : ''}`),
  );
  out.push(...ladderOwed('reviews', f.trustedReviews, (s) => `Badge reward · ${COUNT.format(s)} reviews`));
  for (const id of new Set(f.branchIds ?? [])) {
    out.push({ key: rewardKey('branches', id), badge: 'branches', reward: papic(1), note: 'Badge reward · a new branch' });
  }
  for (const id of new Set(f.bookedCardIds ?? [])) {
    out.push({ key: rewardKey('service_cards', id), badge: 'service_cards', reward: papic(1), note: 'Badge reward · a card’s first booking' });
  }
  const award = BADGE_REWARDS.award;
  if (award.shape === 'period') {
    const seen = new Set<string>();
    for (const a of f.awards ?? []) {
      const reward = award.rewards[a.type];
      const key = rewardKey('award', `${a.type}:${a.periodMonth.slice(0, 10)}`);
      if (!reward || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, badge: 'award', reward, note: `Badge reward · ${AWARD_WORD[a.type]} · ${a.periodMonth.slice(0, 7)}` });
    }
  }
  return out;
}

const AWARD_WORD: Record<SpotlightAwardType, string> = { top_pick: 'Top Pick', most_booked: 'Most Booked', rising: 'Rising' };

/* ── words ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The products' names as the catalogue titles them (the smallest Papic pack, Event Plus, Event Pro). */
export type RewardNames = Readonly<Record<'papic' | 'event_plus' | 'event_pro', string>>;

/** When the catalogue could not be read — product words, never a size or a price. */
export const FALLBACK_REWARD_NAMES: RewardNames = { papic: 'Papic pack', event_plus: 'Event Plus', event_pro: 'Event Pro' };

/** The first Events step that pays a free booking fee — read from the table, so the line can never disagree with it. */
export const FIRST_FREE_FEE_STEP: number =
  MILESTONE_THRESHOLDS.find((s) => EVENTS_STEP_REWARDS[s]?.kind === 'fee_waiver') ?? 0;

/** The free booking fee's row in the gifts list (owner's words: "Free booking fee · your next customer · from 1,000 events"). */
export const FREE_FEE_TITLE = 'Free booking fee';
export const FREE_FEE_SUBLINE = `Your next customer · from ${new Intl.NumberFormat('en-PH').format(FIRST_FREE_FEE_STEP)} events`;
export const FREE_FEE_LINE = `${FREE_FEE_TITLE} · ${FREE_FEE_SUBLINE.charAt(0).toLowerCase()}${FREE_FEE_SUBLINE.slice(1)}`;

/** Which badge a reward came from, as the gifts list reads it: "50 events · Silver" · "Most Booked · Nov 2026". */
export function rewardSourceWords(key: string): string {
  const [head, a, b] = key.split(':');
  switch (head) {
    case 'verified':
      return 'SETNAYAN Verified';
    case 'first_booking':
      return 'First booking through Setnayan';
    case 'events': {
      const n = Number(a);
      return Number.isFinite(n) ? `${COUNT.format(n)} events${stepName(n) ? ` · ${stepName(n)}` : ''}` : 'Events on Setnayan';
    }
    case 'reviews':
      return `${COUNT.format(Number(a) || 0)} reviews`;
    case 'first_pick':
      return `1st Pick · ${COUNT.format(Number(a) || 0)}`;
    case 'booked_loop':
      return `Booked Loop · ${COUNT.format(Number(a) || 0)}`;
    case 'inspiration':
      return `Inspiration box · ${COUNT.format(Number(a) || 0)} photos`;
    case 'branch':
      return 'A new branch';
    case 'card':
      return 'A card’s first booking';
    case 'award': {
      const word = AWARD_WORD[a as SpotlightAwardType] ?? 'Monthly award';
      const d = b ? new Date(`${b.slice(0, 10)}T00:00:00Z`) : null;
      const month = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
      return month ? `${word} · ${month}` : word;
    }
    default:
      return 'Badge reward';
  }
}

/** "Papic 150" · "2 × Event Plus" · "Free booking fee · your next customer". */
export function rewardWords(r: BadgeReward, names: RewardNames = FALLBACK_REWARD_NAMES): string {
  if (r.kind === 'fee_waiver') return 'Free booking fee · your next customer';
  const name = names[r.kind];
  return r.units > 1 ? `${r.units} × ${name}` : name;
}

/* ── the badge page lines ─────────────────────────────────────────────────────────────────────────────────────── */

/** A reward the shop was given, as the badge page and the gifts list read it. */
export type GrantedReward = {
  rewardId: string;
  key: string;
  badge: string;
  kind: BadgeRewardKind;
  units: number;
  grantedAt: string;
  revokedAt: string | null;
  /** A free booking fee: the booking it paid, when it did. */
  usedAt: string | null;
  usedOn: { coupleName: string | null; wouldHaveBeenPhp: number | null } | null;
  /** A free booking fee given back when its booking was cancelled before the day (owner 2026-11-05). */
  returnedAt?: string | null;
  /** The Setnayan gift the couple got with the badge-paid booking, in photos (owner 2026-11-05). */
  setnayanGiftCredits?: number | null;
};

/** (a) what the badge already gave · (b) the next step and its reward. Null = say nothing. */
export type RewardLine = { gave: string | null; next: string | null };

function gaveLine(granted: readonly GrantedReward[] | null, badge: RewardBadge, names: RewardNames, keyPrefix?: string): string | null {
  if (!granted) return null;
  const mine = granted
    .filter((g) => g.badge === badge && !g.revokedAt && (!keyPrefix || g.key.startsWith(keyPrefix)))
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
  const last = mine[0];
  if (!last) return null;
  return `Gave you: ${rewardWords({ kind: last.kind, units: last.units }, names)} · in your gifts`;
}

/**
 * The two reward lines for one badge, from the one table. Ladder badges name their next REWARDING step and how far
 * it is ("Next: 100 events · Gold · 4 to go → 2 × Event Plus"); an unmeasured ladder names its first reward with no
 * count; one-time badges name what they give when earned; "each" badges say what each new one gives.
 */
export function rewardLineFor(
  badge: RewardBadge,
  count: number | null,
  earned: boolean | null,
  granted: readonly GrantedReward[] | null,
  names: RewardNames = FALLBACK_REWARD_NAMES,
): RewardLine {
  const rule = BADGE_REWARDS[badge];
  const gave = gaveLine(granted, badge, names);
  switch (rule.shape) {
    case 'once':
      return { gave, next: earned === true ? null : `When you earn it → ${rewardWords(rule.reward, names)}` };
    case 'each':
      return { gave, next: `${rule.eachWord} → ${rewardWords(rule.reward, names)}` };
    case 'period': {
      const r = rule.rewards;
      return {
        gave,
        next: `Most Booked or Top Pick → ${rewardWords(r.most_booked, names)} · Rising → ${rewardWords(r.rising, names)}`,
      };
    }
    case 'ladder': {
      const paying = rule.steps.filter((s) => s.reward);
      const unitOf = (n: number) => (n === 1 ? rule.unit[0] : rule.unit[1]);
      if (!rule.measured || count === null) {
        const first = paying[0];
        return { gave, next: first ? `First reward: ${COUNT.format(first.step)} ${unitOf(first.step)} → ${rewardWords(first.reward!, names)}` : null };
      }
      const next = paying.find((s) => s.step > count);
      if (!next) return { gave, next: null };
      const tier = badge === 'events' ? stepName(next.step) : null;
      return {
        gave,
        next: `Next: ${COUNT.format(next.step)} ${unitOf(next.step)}${tier ? ` · ${tier}` : ''} · ${COUNT.format(next.step - count)} to go → ${rewardWords(next.reward!, names)}`,
      };
    }
  }
}

/** The badge page's reward line for one current award (its own month): what it gave. */
export function awardGaveLine(
  type: SpotlightAwardType,
  periodMonth: string,
  granted: readonly GrantedReward[] | null,
  names: RewardNames = FALLBACK_REWARD_NAMES,
): string | null {
  if (!granted) return null;
  const key = rewardKey('award', `${type}:${periodMonth.slice(0, 10)}`);
  const g = granted.find((x) => x.key === key && !x.revokedAt);
  return g ? `Gave you: ${rewardWords({ kind: g.kind, units: g.units }, names)} · in your gifts` : null;
}

/* ── the gifts list ───────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The free booking fee's row: how many wait, and the history — earned when, used on which booking. Each entry is a
 * phone row: a short `title` ("₱0 fee · Maria & Juan") and one short `line` ("1,000 events · earned Oct 12 · used
 * Oct 20"); `sentence` is the whole of it in one line, for the ⓘ and a screen reader.
 */
export type FreeFeeSummary = {
  waiting: number;
  history: Array<{ rewardId: string; title: string; line: string; sentence: string; state: 'waiting' | 'used' | 'revoked' }>;
};

function shortDay(iso: string, year = false): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'Asia/Manila' });
}

export function freeFeeSummary(granted: readonly GrantedReward[]): FreeFeeSummary {
  const fees = granted.filter((g) => g.kind === 'fee_waiver').sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
  const history = fees.map((g) => {
    const step = Number(g.key.split(':')[1]);
    const from = Number.isFinite(step) && step > 0 ? `${COUNT.format(step)} events · ` : '';
    const earned = `${from}earned ${shortDay(g.grantedAt)}`;
    const earnedLong = `Earned ${shortDay(g.grantedAt, true)}${from ? ` · ${from.slice(0, -3)}` : ''}`;
    if (g.revokedAt) {
      return { rewardId: g.rewardId, title: FREE_FEE_TITLE, line: `${earned} · taken back`, sentence: `${earnedLong} · taken back by Setnayan`, state: 'revoked' as const };
    }
    if (g.usedAt) {
      const name = g.usedOn?.coupleName?.trim() || null;
      return {
        rewardId: g.rewardId,
        title: `${FREE_FEE_ZERO} fee · ${name ?? 'a booking'}`,
        line: `${earned} · used ${shortDay(g.usedAt)}`,
        sentence:
          `${earnedLong} · used ${shortDay(g.usedAt, true)}${name ? ` on ${name}` : ''} · ${FREE_FEE_ZERO} fee · Badge reward` +
          (g.setnayanGiftCredits && g.setnayanGiftCredits > 0
            ? ` · your couple still got the Setnayan gift, ${COUNT.format(g.setnayanGiftCredits)} Papic photos`
            : ''),
        state: 'used' as const,
      };
    }
    // Given back when its booking was cancelled before the day (owner 2026-11-05) — waiting again.
    const back = g.returnedAt ? ` · back ${shortDay(g.returnedAt)}` : '';
    return {
      rewardId: g.rewardId,
      title: FREE_FEE_TITLE,
      line: `${earned}${back}`,
      sentence: `${earnedLong}${g.returnedAt ? ` · given back ${shortDay(g.returnedAt, true)} when that booking was cancelled` : ''} · waiting for your next customer`,
      state: 'waiting' as const,
    };
  });
  return { waiting: history.filter((h) => h.state === 'waiting').length, history };
}

/** The fee a badge reward leaves: nothing. Formatted like every peso on the page. */
const FREE_FEE_ZERO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(0);

/* ── the badge page: every tracker row with its reward ───────────────────────────────────────────────────────── */

export type TrackerRewardInput = {
  facts: BadgeRewardFacts;
  /** Null = the rewards could not be read: no "Gave you" line is drawn (never "nothing given"). */
  granted: readonly GrantedReward[] | null;
  names: RewardNames;
  /** The award rows' titles → their type (`AWARD_LABELS`, read on the server — this file stays pure). */
  awardTypeByTitle: Readonly<Record<string, SpotlightAwardType>>;
  /** 'YYYY-MM-01' — the month the current award rows belong to. */
  periodMonth: string;
};

function rewardBadge(key: string, glyph: string | null, label: string): ShopBadge {
  return { key: `reward:${key}`, kind: 'reward', glyph, line1: 'SETNAYAN', line2: label.toUpperCase(), label };
}

const NOT_COUNTED_LINE = 'Setnayan doesn’t count this one yet';

function countedRow(
  badge: 'reviews',
  title: string,
  glyph: string,
  count: number | null,
  words: readonly [string, string],
  r: TrackerRewardInput,
): TrackerRow {
  const reward = rewardLineFor(badge, count, null, r.granted, r.names);
  const b = rewardBadge(badge, count === null ? '—' : COUNT.format(count), title);
  if (count === null) {
    return { kind: 'reward', key: b.key, badge: b, title, line: `Your ${words[1]} couldn’t be counted just now`, state: 'unread', stateWord: 'Couldn’t load', reward };
  }
  const rule = BADGE_REWARDS[badge];
  const steps = rule.shape === 'ladder' ? rule.steps.map((s) => s.step) : [];
  const next = steps.find((s) => s > count);
  const line = `${COUNT.format(count)} ${count === 1 ? words[0] : words[1]}`;
  if (next === undefined) return { kind: 'reward', key: b.key, badge: { ...b, glyph }, title, line, state: 'earned', stateWord: 'Earned', bar: 100, reward };
  return {
    kind: 'reward',
    key: b.key,
    badge: b,
    title,
    line,
    state: 'to_go',
    stateWord: `${COUNT.format(next - count)} to go`,
    bar: Math.max(0, Math.min(100, (count / next) * 100)),
    reward,
  };
}

function notCountedRow(badge: 'first_pick' | 'booked_loop' | 'inspiration', glyph: string, r: TrackerRewardInput): TrackerRow {
  const rule = BADGE_REWARDS[badge];
  const b = rewardBadge(badge, glyph, rule.title);
  return {
    kind: 'reward',
    key: b.key,
    badge: b,
    title: rule.title,
    line: NOT_COUNTED_LINE,
    state: 'not_counted',
    stateWord: 'Soon',
    reward: rewardLineFor(badge, null, null, r.granted, r.names),
  };
}

/**
 * The tracker rows (`badgeTracker`) with their rewards, plus one row for every badge that pays a reward but has no
 * row yet — the measured ones with their count, the unmeasured ones saying so ("Soon"), never with a made-up count.
 * Rating and Years pay nothing and get no reward line.
 */
export function badgeRowsWithRewards(rows: readonly TrackerRow[], r: TrackerRewardInput): TrackerRow[] {
  const f = r.facts;
  const out: TrackerRow[] = [];
  for (const row of rows) {
    if (row.kind === 'verified') {
      out.push({ ...row, reward: rewardLineFor('verified', null, f.verified, r.granted, r.names) });
    } else if (row.kind === 'milestone') {
      out.push({ ...row, reward: rewardLineFor('events', f.completedEvents, null, r.granted, r.names) });
      out.push(...rewardOnlyRows(r));
    } else if (row.kind === 'award') {
      const type = r.awardTypeByTitle[row.title];
      out.push(type ? { ...row, reward: { gave: awardGaveLine(type, r.periodMonth, r.granted, r.names), next: null } } : row);
    } else {
      out.push(row);
    }
  }
  const awards = f.awards ?? [];
  const awardRule = BADGE_REWARDS.award;
  const ab = rewardBadge('award', '★', awardRule.title);
  out.push({
    kind: 'reward',
    key: ab.key,
    badge: ab,
    title: awardRule.title,
    line: f.awards === null ? 'Your awards couldn’t be read just now' : awards.length > 0 ? `${COUNT.format(awards.length)} won so far` : 'Given each month by Setnayan',
    state: f.awards === null ? 'unread' : awards.length > 0 ? 'earned' : 'not_yet',
    stateWord: f.awards === null ? 'Couldn’t load' : awards.length > 0 ? 'Earned' : 'Not yet',
    reward: rewardLineFor('award', null, null, r.granted, r.names),
  });
  return out;
}

function rewardOnlyRows(r: TrackerRewardInput): TrackerRow[] {
  const f = r.facts;
  const rows: TrackerRow[] = [];

  const fb = BADGE_REWARDS.first_booking;
  const fbBadge = rewardBadge('first_booking', '1st', fb.title);
  const fbReward = rewardLineFor('first_booking', null, f.firstSourcedBooking, r.granted, r.names);
  rows.push(
    f.firstSourcedBooking === null
      ? { kind: 'reward', key: fbBadge.key, badge: fbBadge, title: fb.title, line: 'Your bookings couldn’t be read just now', state: 'unread', stateWord: 'Couldn’t load', reward: fbReward }
      : f.firstSourcedBooking
        ? { kind: 'reward', key: fbBadge.key, badge: fbBadge, title: fb.title, line: 'Your first couple through Setnayan', state: 'earned', stateWord: 'Earned', bar: 100, reward: fbReward }
        : { kind: 'reward', key: fbBadge.key, badge: fbBadge, title: fb.title, line: 'Your first couple booked through Setnayan', state: 'not_yet', stateWord: 'Not yet', reward: fbReward },
  );

  rows.push(countedRow('reviews', BADGE_REWARDS.reviews.title, '★', f.trustedReviews, ['trusted review', 'trusted reviews'], r));

  for (const [badge, ids, one, many] of [
    ['branches', f.branchIds, 'branch', 'branches'],
    ['service_cards', f.bookedCardIds, 'card booked through Setnayan', 'cards booked through Setnayan'],
  ] as const) {
    const rule = BADGE_REWARDS[badge];
    const n = ids === null ? null : new Set(ids).size;
    const b = rewardBadge(badge, n === null ? '—' : COUNT.format(n), rule.title);
    const reward = rewardLineFor(badge, n, null, r.granted, r.names);
    rows.push(
      n === null
        ? { kind: 'reward', key: b.key, badge: b, title: rule.title, line: `Your ${many} couldn’t be counted just now`, state: 'unread', stateWord: 'Couldn’t load', reward }
        : { kind: 'reward', key: b.key, badge: b, title: rule.title, line: n > 0 ? `${COUNT.format(n)} ${n === 1 ? one : many}` : `No ${many} yet`, state: n > 0 ? 'live' : 'not_yet', stateWord: n > 0 ? 'Live' : 'Not yet', reward },
    );
  }

  rows.push(notCountedRow('first_pick', '1st', r));
  rows.push(notCountedRow('booked_loop', '↻', r));
  rows.push(notCountedRow('inspiration', '✦', r));
  return rows;
}
