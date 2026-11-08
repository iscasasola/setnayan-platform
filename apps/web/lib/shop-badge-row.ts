/**
 * 🏅 THE ONE BADGE ROW — Shop's image badges, in ONE row, the closest goal first (THE ONE BUILD, lane C4; owner v110
 * "Badges = Fable's IMAGE badges", v112 "the closest badge first with 'N to go'", spec §1 "ONE badge row").
 *
 * PURE. Built ON the shipped engine, never beside it: every tile is a `TrackerRow` that `badgeTracker`
 * (`lib/shop-badges.ts`) and `badgeRowsWithRewards` (`lib/badge-rewards.ts`, #7298 with the APPROVED 8 Nov table) already
 * made — its state, its "N to go", its reward lines. This file only decides the PICTURE (shape · material · the number
 * on the face), the ORDER, and which rows are hidden. The ladders are the engine's own (`MILESTONE_THRESHOLDS`,
 * `BADGE_REWARDS[...].steps`) — no number is typed here.
 *
 * 🔑 THE ORDER (v112): the badge closest to its next step first — furthest along its current rung (the prototype's
 * `nextToEarn`: (n − step reached) / (next − step reached)) — saying "N to go"; then the other ladders, each saying where
 * it stands; then what is earned or live; then what is not yet; then what is not counted or could not be read.
 *
 * 🔑 HONEST: an unread count is "Couldn't load" on a grey face with "—", never "0". A badge with no counter in the
 * app says "Not counted yet" (1st Pick, the first 5★ review — spec §4: shown, never counted, pays nothing). The
 * BOOKED LOOP (and the first loop, which hangs off it) is counted by C2's `shop_booked_loop_count` (spec §9 #11) and
 * HIDDEN whenever that count was not read — "Without the counter the badge is HIDDEN, never shown as 'not yet reached'".
 * 🔒 lib/shop-badge-row.test.ts
 */
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { BADGE_REWARDS } from '@/lib/badge-rewards';
import type { BadgeRewardFacts } from '@/lib/badge-rewards';
import type { TrackerRow } from '@/lib/shop-badges';

/** The badge faces, from the approved corpus art (`prototypes/for_suppliers_2026-11-06`, "ibgrid"). */
export type BadgeShape = 'seal' | 'hex' | 'star' | 'rosette';
export type BadgeFace = 'navy' | 'ivory' | 'gold' | 'first' | 'month' | LadderMaterial;
/** One per rung of a ladder, bottom first — the shipped tier names (`lib/badge-tiers.ts` MATERIALS). */
export const LADDER_MATERIALS = ['bronze', 'silver', 'gold', 'plat', 'diamond', 'ruby', 'black'] as const;
export type LadderMaterial = (typeof LADDER_MATERIALS)[number];
export const LADDER_MATERIAL_NAME: Readonly<Record<LadderMaterial, string>> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  plat: 'Platinum',
  diamond: 'Diamond',
  ruby: 'Ruby',
  black: 'Black Diamond',
};

export const NOT_COUNTED_YET = 'Not counted yet';
export const COULDNT_LOAD = 'Couldn’t load';

export type BadgeLadder = {
  count: number;
  steps: readonly number[];
  /** The highest step reached, or null below the first. */
  reached: number | null;
  /** The next step, or null at the top. */
  next: number | null;
  toGo: number | null;
  /** Progress within the current rung toward `next` (0–100); 100 at the top. */
  pct: number;
  unit: readonly [singular: string, plural: string];
};

export type BadgeTile = {
  key: string;
  /** The caption under the picture, and the sheet's title. */
  title: string;
  shape: BadgeShape;
  face: BadgeFace;
  /** What sits in the middle of the face, and the small word under it. */
  num: string;
  mini: string;
  /** Coloured (something earned or live) — grey when not yet. */
  on: boolean;
  /** The line under the caption: "7 to go" · "Earned" · "Not counted yet" · "Couldn't load" … */
  sub: string;
  /** The closest goal's "N to go" is the one that stands out. */
  goal: boolean;
  /** What the badge is, in one sentence (the sheet's first line). */
  how: string;
  ladder: BadgeLadder | null;
  /** The engine's row — its line, door and reward lines feed the sheet. */
  row: TrackerRow;
};

export type BadgeRowInput = {
  /** `badgeRowsWithRewards(badgeTracker(facts), rewards)` — or `badgeTracker(facts)` when the rewards were unread. */
  rows: readonly TrackerRow[] | null;
  /** The counts the ladders climb (`TrackerRewardInput.facts`); null = unread → those ladders say "Couldn't load". */
  counts: BadgeRewardFacts | null;
  /** The public completed-events count (the milestone's own number); null = unread. */
  completedEvents: number | null;
  /** Trusted reviews (`vendor_trusted_review_stats`), as read. */
  trusted: { trusted_avg_rating: number | null; trusted_review_count: number | null } | null;
  inBusinessSinceYear: number | null;
  /** `vendor_profiles.is_founder` + the year the shop opened; null = unread → no tile (a status, never "not yet"). */
  founding: { isFounder: boolean; joinedYear: number | null } | null;
};

const COUNT = new Intl.NumberFormat('en-PH');
const fmt = (n: number) => COUNT.format(n);

/** "1k" · "5k" · "120" — the face keeps short; the sheet says the number in full. */
export function faceNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(n);
}

/** Where a count sits on a ladder. Pure — tested. */
export function ladderOf(count: number, steps: readonly number[], unit: readonly [string, string]): BadgeLadder {
  let i = -1;
  steps.forEach((s, j) => {
    if (count >= s) i = j;
  });
  const reached = i >= 0 ? steps[i]! : null;
  const next = steps[i + 1] ?? null;
  const toGo = next === null ? null : next - count;
  // Progress within the rung (the prototype's `nextToEarn`): from the step reached to the next one.
  const from = reached ?? 0;
  const pct = next === null ? 100 : Math.max(0, Math.min(100, Math.round(((count - from) / (next - from)) * 100)));
  return { count, steps, reached, next, toGo, pct, unit };
}

/** The material a ladder wears: the rung it reached (bottom = bronze); below the first step it wears bronze, grey. */
export function ladderMaterial(l: BadgeLadder): LadderMaterial {
  const i = l.reached === null ? 0 : l.steps.indexOf(l.reached);
  return LADDER_MATERIALS[Math.min(Math.max(0, i), LADDER_MATERIALS.length - 1)]!;
}

const stepsOf = (badge: keyof typeof BADGE_REWARDS): readonly number[] => {
  const r = BADGE_REWARDS[badge];
  return r.shape === 'ladder' ? r.steps.map((s) => s.step) : [];
};
const unitOf = (badge: keyof typeof BADGE_REWARDS): readonly [string, string] => {
  const r = BADGE_REWARDS[badge];
  return r.shape === 'ladder' ? r.unit : ['', ''];
};

/** The ladder badges, their face word and what each counts (the app's words). */
const LADDERS = {
  'reward:reviews': { badge: 'reviews', mini: 'REVIEWS', how: 'Trusted reviews — from the hosts and co-hosts of events you were booked for.' },
  'reward:service_cards': { badge: 'service_cards', mini: 'CARDS', how: 'Live service cards across your services.' },
  'reward:inspiration': { badge: 'inspiration', mini: 'PHOTOS', how: 'Your inspiration photos that Setnayan approved for the library.' },
  'reward:branches': { badge: 'branches', mini: 'BRANCHES', how: 'Your paid, live branches.' },
  'reward:booked_loop': { badge: 'booked_loop', mini: 'LOOP', how: 'Families who booked you again for another event.' },
} as const;

const FIRSTS: Readonly<Record<string, { num: string; mini: string; how: string }>> = {
  'reward:first_booking': { num: '1st', mini: 'BOOKING', how: 'Your first couple booked through Setnayan.' },
  'reward:first_review': { num: '1st', mini: 'REVIEW', how: 'Your first review from a booked couple.' },
  'reward:first_five_star': { num: '5★', mini: '5★ REVIEW', how: 'Your first 5-star review.' },
  'reward:first_loop': { num: '↺', mini: 'LOOP', how: 'A family booked you again for the first time.' },
  'reward:first_first_pick': { num: '1st', mini: 'PICK', how: 'Your first booking after Setnayan recommended you first.' },
};

/** Hidden whenever C2's counter was not read — never drawn as "not yet reached". */
const NEEDS_LOOP_COUNTER = new Set(['reward:booked_loop', 'reward:first_loop']);
const loopsRead = (i: BadgeRowInput) => i.counts !== null && i.counts.bookedLoops !== undefined && i.counts.bookedLoops !== null;

function stateSub(row: TrackerRow): string {
  if (row.state === 'unread') return COULDNT_LOAD;
  if (row.state === 'not_counted') return NOT_COUNTED_YET;
  return row.stateWord;
}

function ladderTile(row: TrackerRow, title: string, mini: string, how: string, count: number | null, steps: readonly number[], unit: readonly [string, string]): BadgeTile {
  if (count === null || row.state === 'unread') {
    return { key: row.key, title, shape: 'hex', face: 'bronze', num: '—', mini, on: false, sub: COULDNT_LOAD, goal: false, how, ladder: null, row };
  }
  const l = ladderOf(count, steps, unit);
  return {
    key: row.key,
    title,
    shape: 'hex',
    face: ladderMaterial(l),
    num: faceNumber(count),
    mini,
    on: l.reached !== null,
    // Only the closest goal says "N to go" (set in `shopBadgeRow`); the rest say where they stand.
    sub: l.reached === null ? 'Not yet' : LADDER_MATERIAL_NAME[ladderMaterial(l)],
    goal: false,
    how,
    ladder: l,
    row,
  };
}

function tileFor(row: TrackerRow, i: BadgeRowInput): BadgeTile | null {
  if (NEEDS_LOOP_COUNTER.has(row.key) && !loopsRead(i)) return null;

  if (row.kind === 'verified') {
    return {
      key: row.key,
      title: 'Setnayan Verified',
      shape: 'seal',
      face: 'navy',
      num: '✓',
      mini: 'VERIFIED',
      on: row.state === 'earned',
      sub: stateSub(row),
      goal: false,
      how: 'Documents approved — DTI or SEC, BIR 2303, Mayor’s Permit and bank proof.',
      ladder: null,
      row,
    };
  }
  if (row.kind === 'milestone') {
    return ladderTile(row, 'Events', 'EVENTS', 'Events you finished on Setnayan.', i.completedEvents, MILESTONE_THRESHOLDS, ['event', 'events']);
  }
  if (row.kind === 'rating') {
    const t = i.trusted;
    const count = t?.trusted_review_count ?? 0;
    const avg = t?.trusted_avg_rating ?? 0;
    const live = row.state === 'live' && count > 0 && avg > 0;
    return {
      key: row.key,
      title: 'Rating',
      shape: 'seal',
      face: 'gold',
      num: live ? avg.toFixed(1) : '—',
      mini: 'RATING',
      on: live,
      sub: row.state === 'unread' ? COULDNT_LOAD : live ? `${fmt(count)} ${count === 1 ? 'review' : 'reviews'}` : 'No reviews yet',
      goal: false,
      // The shipped rule: Rating has no goal and no bar (`badgeTracker`).
      how: 'The average from trusted reviews — hosts and co-hosts only. No goal.',
      ladder: null,
      row,
    };
  }
  if (row.kind === 'years') {
    const y = i.inBusinessSinceYear;
    return {
      key: row.key,
      title: 'Business since',
      shape: 'seal',
      face: 'ivory',
      num: y ? String(y).slice(-2) : '—',
      mini: 'SINCE',
      on: row.state === 'earned',
      sub: y ? String(y) : 'Add the year you started',
      goal: false,
      how: 'The year your business started (your details). It needs no goal.',
      ladder: null,
      row,
    };
  }
  if (row.kind === 'award') {
    return { key: row.key, title: row.title, shape: 'rosette', face: 'month', num: '★', mini: 'AWARD', on: true, sub: 'This month', goal: false, how: 'Given each month by Setnayan.', ladder: null, row };
  }
  // ── the reward-only rows (#7298) ──
  if (row.key === 'reward:award') {
    return {
      key: row.key,
      title: 'Monthly awards',
      shape: 'rosette',
      face: 'month',
      num: '★',
      mini: 'MONTHLY',
      on: row.state === 'earned',
      sub: stateSub(row),
      goal: false,
      how: 'Setnayan’s Top Pick, Most Booked and Rising Star — given each month by Setnayan.',
      ladder: null,
      row,
    };
  }
  const lad = LADDERS[row.key as keyof typeof LADDERS];
  if (lad) {
    const c = i.counts;
    const count =
      c === null
        ? null
        : lad.badge === 'reviews'
          ? c.trustedReviews
          : lad.badge === 'service_cards'
            ? c.serviceCards
            : lad.badge === 'inspiration'
              ? c.inspirationPhotos
              : lad.badge === 'booked_loop'
                ? (c.bookedLoops ?? null)
                : c.branchIds === null
                  ? null
                  : new Set(c.branchIds).size;
    return ladderTile(row, row.title, lad.mini, lad.how, count, stepsOf(lad.badge), unitOf(lad.badge));
  }
  const first = FIRSTS[row.key];
  if (first) {
    return { key: row.key, title: row.title, shape: 'star', face: 'first', num: first.num, mini: first.mini, on: row.state === 'earned', sub: stateSub(row), goal: false, how: first.how, ladder: null, row };
  }
  if (row.key === 'reward:first_pick') {
    return {
      key: row.key,
      title: '1st Pick',
      shape: 'hex',
      face: 'bronze',
      num: '—',
      mini: '1ST PICK',
      on: false,
      sub: NOT_COUNTED_YET,
      goal: false,
      how: 'Bookings after Setnayan recommended you first.',
      ladder: null,
      row,
    };
  }
  return null;
}

function foundingTile(i: BadgeRowInput): BadgeTile | null {
  if (!i.founding?.isFounder) return null;
  const y = i.founding.joinedYear;
  const row: TrackerRow = {
    kind: 'reward',
    key: 'founding',
    badge: { key: 'founding', kind: 'reward', glyph: '★', line1: 'FOUNDING', line2: 'MEMBER', label: 'Founding member' },
    title: 'Founding member',
    line: y ? `Joined ${y}` : 'Joined at the start',
    state: 'earned',
    stateWord: 'Earned',
  };
  return {
    key: 'founding',
    title: 'Founding member',
    shape: 'seal',
    face: 'ivory',
    num: y ? String(y).slice(-2) : '★',
    mini: 'FOUNDING',
    on: true,
    sub: y ? `Joined ${y}` : 'Earned',
    goal: false,
    how: 'One of the shops that joined Setnayan at the start.',
    ladder: null,
    row,
  };
}

/** 0 · a ladder with a step to go · 1 · earned or live · 2 · not yet · 3 · not counted or unread. */
function band(t: BadgeTile): number {
  if (t.ladder && t.ladder.toGo !== null) return 0;
  if (t.sub === NOT_COUNTED_YET || t.sub === COULDNT_LOAD) return 3;
  return t.on ? 1 : 2;
}

/**
 * The one row: every badge as a tile, the closest goal first. Null in = null out (the badges could not be read:
 * the row says "Couldn't load", never an empty shelf).
 */
export function shopBadgeRow(i: BadgeRowInput): BadgeTile[] | null {
  if (!i.rows) return null;
  const tiles: BadgeTile[] = [];
  const seen = new Set<string>();
  for (const row of i.rows) {
    const t = tileFor(row, i);
    if (!t || seen.has(t.key)) continue;
    seen.add(t.key);
    tiles.push(t);
  }
  const f = foundingTile(i);
  if (f) tiles.splice(1, 0, f);
  const order = tiles.map((t, n) => ({ t, n }));
  order.sort((a, b) => {
    const ba = band(a.t);
    const bb = band(b.t);
    if (ba !== bb) return ba - bb;
    if (ba === 0) {
      const p = b.t.ladder!.pct - a.t.ladder!.pct;
      if (p !== 0) return p;
      const d = a.t.ladder!.toGo! - b.t.ladder!.toGo!;
      if (d !== 0) return d;
    }
    return a.n - b.n;
  });
  const out = order.map((o) => o.t);
  if (out[0] && band(out[0]) === 0) out[0] = { ...out[0], goal: true, sub: `${fmt(out[0].ladder!.toGo!)} to go` };
  return out;
}

/** The sheet's goal line: "Next goal: 25 approved inspiration photos — 7 to go." Null = no goal (Rating, the top). */
export function nextGoalLine(t: BadgeTile): string | null {
  const l = t.ladder;
  if (!l || l.next === null || l.toGo === null) return null;
  const unit = l.next === 1 ? l.unit[0] : l.unit[1];
  return `Next goal: ${fmt(l.next)} ${unit} — ${fmt(l.toGo)} to go.`;
}

/** The sheet's "Now" line: "Now · 18 photos". */
export function nowLine(t: BadgeTile): string {
  const l = t.ladder;
  if (l) {
    const unit = l.count === 1 ? l.unit[0] : l.unit[1];
    return `Now · ${fmt(l.count)} ${unit}${l.reached !== null ? ` · ${LADDER_MATERIAL_NAME[ladderMaterial(l)]}` : ''}`;
  }
  return `Now · ${t.row.line}`;
}
