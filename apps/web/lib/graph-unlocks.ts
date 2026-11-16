/**
 * 🏅📊 EACH BADGE'S BRONZE OPENS ITS OWN GRAPHS (J5; owner 15 Nov — DECISION_LOG 7d6c8129 "all supplier badge + seal
 * prototypes approved … graphs by Bronze"; contract `Setnayan-specs/prototypes/supplier_badges_2026-11-15/badge-unlock_v6.html`).
 *
 *   Completed bookings Bronze → Your slow months · Dates you lost · Who brings you couples   (slow · lost · split)
 *   Five-star reviews Bronze  → What couples say · Replies that book                        (rep · replyvs)
 *   Gifts given Bronze        → Gifts given → bookings                                       (gifts, NEW)
 *   Trusted by Bronze         → none yet — its old graph "Which partners send you couples" no longer fits now that
 *                               Trusted by counts returning clients (50566f42); open item 10, nothing drawn until ruled.
 *   Invites Bronze            → Suppliers you invited (ONE graph, month by month: invited · booked · completed an
 *                               event — specs 7fbff0cd (10)). Waits while `BADGE_REWARDS.invites.measured` is false
 *                               (`notCountedYet`) — it flips when the invites record lands; nothing here changes.
 * The sign-up graphs, the Verified graphs and the Pro graphs open exactly as they do today; this file decides only the
 * badge ones.
 *
 * THE RULES (badge-unlock_v6 "The rules"):
 *   · An unearned graph is NEVER drawn, not even greyed — one plain line stands in its place, under the carousel.
 *   · "Shops that already see graphs today keep them" (owner: "Yes") — `kept` (the migration's marker) opens every
 *     graph that existed before the move. The NEW gifts graph is not something a kept shop "had", so it opens by its
 *     badge for everyone.
 *   · Keep what you had: a Bronze once EARNED (a `shop_badge_rewards` step) keeps its graphs if the count later dips.
 *   · Rewards and counts are read, never invented. A count we could not read is never treated as 0: when we cannot
 *     tell whether a badge is reached, its graphs are SHOWN (fail open) — they are the shop's own numbers, which it saw
 *     yesterday, and hiding them would read as "locked" when the truth is "we don't know".
 *
 * 🔑 MAIN'S PIECES, NEVER A COPY: the badges, their Bronze (`SHOP_BADGE_STEPS[b][0]`) and tier names are
 * lib/badge-tiers.ts; the names and "is it counted" are `BADGE_REWARDS` (lib/badge-rewards.ts); the counts are main's
 * readers (badge-rewards.server.ts). `earnedBronze` is main's `paidTiers` (new `<badge>:tierN` keys and the legacy
 * `events:<step>` / `reviews:<step>` keys), never a second reading of them.
 *
 * PURE: no I/O, no React. 🔒 lib/graph-unlocks.test.ts
 */
import type { GrowthRec } from './vendor-growth-recs';
import { formatCount } from './format-number';
import { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, TIER_KEYS, tierName, type ShopBadgeKey } from './badge-tiers';
import { BADGE_REWARDS, paidTiers } from './badge-rewards';

/** The five shop badges — J0's `ShopBadgeKey` itself (lib/badge-tiers.ts), never a second list. */
export type UnlockBadge = ShopBadgeKey;

export const UNLOCK_BADGES: readonly UnlockBadge[] = SHOP_BADGE_KEYS;

/** The badge names — `BADGE_REWARDS[badge].title` (lib/badge-rewards.ts), the names the badge screen draws. */
export const BADGE_NAME: Readonly<Record<UnlockBadge, string>> = Object.fromEntries(
  UNLOCK_BADGES.map((b) => [b, BADGE_REWARDS[b].title]),
) as Record<UnlockBadge, string>;

/** Each badge's Bronze — the FIRST step of its own ladder, `SHOP_BADGE_STEPS[badge][0]` (lib/badge-tiers.ts). No copy. */
export const BRONZE_STEP: Readonly<Record<UnlockBadge, number>> = Object.fromEntries(
  UNLOCK_BADGES.map((b) => [b, SHOP_BADGE_STEPS[b][0]!]),
) as Record<UnlockBadge, number>;

/** The graphs each badge's Bronze opens (badge-unlock_v6 `BADGES`, with today's two open items left empty). */
export const BADGE_GRAPHS: Readonly<Record<UnlockBadge, readonly string[]>> = {
  completed_bookings: ['slow', 'lost', 'split'],
  five_star_reviews: ['rep', 'replyvs'],
  gifts_given: ['gifts'],
  // Open item 10 (a33fd894): "Which partners send you couples" no longer fits Trusted by — none until ruled.
  trusted_by: [],
  // Ruled 15 Nov (specs 7fbff0cd (10)): ONE graph, month by month.
  invites: ['invites'],
};

/** Graphs new with this change — a kept shop never "had" them; they sit at the end of the carousel, marked New. */
export const NEW_BADGE_GRAPHS: readonly string[] = ['gifts', 'invites'];

/**
 * ⏸ A badge with NO record to count yet — read from the ONE place that says so, `BADGE_REWARDS[badge].measured`
 * (lib/badge-rewards.ts: Invites is `measured: false` until the add/invite door records it, owner 6439 (4)). The day
 * that record lands and flips `measured`, the badge is counted here too — nothing in this file changes.
 */
export function notCountedYet(badge: UnlockBadge): boolean {
  return !BADGE_REWARDS[badge].measured;
}

/** Every graph a badge decides. */
export const BADGE_GATED_GRAPHS: readonly string[] = UNLOCK_BADGES.flatMap((b) => BADGE_GRAPHS[b]);

export type UnlockFacts = {
  /** The keep marker; null = not read. */
  kept: boolean | null;
  /** Each badge's live count (main's counters). `null` = the read FAILED (we don't know → graphs stay shown). */
  counts: Partial<Record<UnlockBadge, number | null>>;
  /** Every unrevoked badge reward key the shop holds; null = not read (or malformed — never `[]`). */
  earned: readonly string[] | null;
};

export type BadgeGate = 'open' | 'locked' | 'unknown';

/** Has this badge EVER been earned at Bronze or above (keep what you had)? null = the earned list was not read. */
export function earnedBronze(badge: UnlockBadge, earned: readonly string[] | null): boolean | null {
  if (earned === null) return null;
  // main's ONE rule for what a shop's reward keys have paid — new `<badge>:tierN` keys and the legacy
  // `events:<step>` / `reviews:<step>` keys alike (lib/badge-rewards.ts `paidTiers`). Any tier paid = Bronze reached.
  const paid = paidTiers(earned);
  return TIER_KEYS.some((t) => paid.has(`${badge}:${t}`));
}

/**
 * One badge's gate: open (reached now, or ever earned) · locked (never earned, and the count — where it is counted —
 * is below Bronze) · unknown (a read failed: the earned list, or a count).
 */
export function badgeGate(badge: UnlockBadge, facts: UnlockFacts): BadgeGate {
  const count = facts.counts[badge];
  if (typeof count === 'number' && Number.isFinite(count) && count >= BRONZE_STEP[badge]) return 'open';
  const ever = earnedBronze(badge, facts.earned);
  if (ever === true) return 'open';
  if (ever === null || count === null) return 'unknown';
  return 'locked';
}

/**
 * The plain lines under the carousel, word for word from badge-unlock_v6 (`.more`: "More graphs open as you earn
 * badges", then `BADGES[b].line`). Only the badges the drawing gives a line; a badge with no line in the drawing
 * (Invites — ruled after it) shows none, and its badge screen says "Not counted yet".
 */
export const LOCKED_HEAD = 'More graphs open as you earn badges';
export const BRONZE_LINES: Partial<Record<UnlockBadge, { lead: string; rest: string }>> = {
  completed_bookings: { lead: 'Events Bronze', rest: 'shows you your slow months' },
  five_star_reviews: { lead: 'Reviews Bronze', rest: 'shows you what couples say' },
  gifts_given: { lead: 'Gift points Bronze', rest: 'shows you which gifts turn into bookings' },
};

export type LockedBadge = { badge: UnlockBadge; name: string; graphs: readonly string[] };

export type GraphUnlocks = {
  /** Graphs NOT drawn (locked by a badge the shop has not reached, or not counted yet). */
  hidden: ReadonlySet<string>;
  /** One entry per badge whose graphs are hidden — the carousel prints its drawing line, under itself. */
  locked: readonly LockedBadge[];
  /** Graphs drawn because we could not tell (fail open) — said as "Couldn’t load", never shown as locked or 0. */
  unsure: readonly UnlockBadge[];
};

/** Which badge graphs this shop sees. Only badges that open graphs produce a line. */
export function graphUnlocks(facts: UnlockFacts): GraphUnlocks {
  const hidden = new Set<string>();
  const locked: LockedBadge[] = [];
  const unsure: UnlockBadge[] = [];
  for (const badge of UNLOCK_BADGES) {
    const graphs = BADGE_GRAPHS[badge];
    if (graphs.length === 0) continue;
    // Not counted yet: there is nothing to draw it from and nothing to earn it by — its graphs wait, with no line.
    if (notCountedYet(badge)) {
      for (const g of graphs) hidden.add(g);
      continue;
    }
    const gate = badgeGate(badge, facts);
    if (gate === 'open') continue;
    if (gate === 'unknown') {
      unsure.push(badge);
      continue;
    }
    // A kept shop keeps every graph it had; a graph new with this change still waits for its badge.
    const shut = facts.kept === true ? graphs.filter((g) => NEW_BADGE_GRAPHS.includes(g)) : [...graphs];
    if (shut.length === 0) continue;
    for (const g of shut) hidden.add(g);
    locked.push({ badge, name: BADGE_NAME[badge], graphs: shut });
  }
  return { hidden, locked, unsure };
}

/** The drawing's line for a locked badge ("<b>Events Bronze</b> shows you your slow months."); null = none drawn. */
export function lockedLine(l: { badge: UnlockBadge }): { lead: string; rest: string } | null {
  return BRONZE_LINES[l.badge] ?? null;
}

/** Gift points to the badge's next tier, from the shop's live count and `SHOP_BADGE_STEPS` ("450", "Silver"). */
export function giftPointsToNext(points: number | null | undefined): { left: number; tier: string } | null {
  if (typeof points !== 'number' || !Number.isFinite(points)) return null;
  const steps = SHOP_BADGE_STEPS.gifts_given;
  const i = steps.findIndex((st) => st > points);
  if (i < 0) return null;
  return { left: steps[i]! - points, tier: tierName(TIER_KEYS[i]!) };
}

// ── The Gifts given → bookings graph (Gifts given Bronze) ─────────────────────────────────────────────────────────

/** The four numbers the gifts graph draws, plus the free stock its recommendation needs. */
export type GiftsToBookings = {
  giftedBooked: number;
  giftedDeciding: number;
  plainBooked: number;
  plainDeciding: number;
  freeStock: number;
};

const share = (booked: number, deciding: number): number | null => (booked + deciding > 0 ? booked / (booked + deciding) : null);
const pct = (r: number | null): string => (r === null ? '—' : `${Math.round(r * 100)}%`);

/** The graph's one line ("5 of the 9 couples you gave a gift to booked you (56%); 3 of the 24 you did not (13%)."). */
export function giftsLine(g: GiftsToBookings): string {
  const gifted = g.giftedBooked + g.giftedDeciding;
  const plain = g.plainBooked + g.plainDeciding;
  const a = `${formatCount(g.giftedBooked)} of the ${formatCount(gifted)} ${gifted === 1 ? 'couple' : 'couples'} you gave a gift to booked you (${pct(share(g.giftedBooked, g.giftedDeciding))})`;
  const b = `${formatCount(g.plainBooked)} of the ${formatCount(plain)} you did not (${pct(share(g.plainBooked, g.plainDeciding))})`;
  return `${a}; ${b}.`;
}

/** The two worked examples the drawing gives ("a Papic 1000 is 50 points, an Event Plus 300"), as their catalog codes. */
export const GIFT_POINT_EXAMPLES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'PAPIC_GUEST_1K', name: 'a Papic 1000' },
  { code: 'EVENT_PLUS', name: 'an Event Plus' },
];

/** What the recommendation reads besides the graph: the shop's gift points, and each example's points (from its price). */
export type GiftsRecFacts = { giftPoints: number | null; examplePoints: ReadonlyArray<{ name: string; points: number }> | null };

/**
 * The gifts graph's recommendation, word for word from badge-unlock_v6 `RECS.give_gifts`, every number read: it FIRES
 * when couples who asked are still deciding (not yet given a gift) and the shop has gift stock; it is HIGH impact when
 * gifted couples book at least twice as often as the rest. Never made up — no stock or nobody deciding means no task.
 * A part whose number could not be read is left out, never guessed.
 */
export function giftsRec(g: GiftsToBookings | null, more: GiftsRecFacts = { giftPoints: null, examplePoints: null }): GrowthRec | null {
  if (!g) return null;
  const deciding = g.plainDeciding;
  if (deciding <= 0 || g.freeStock <= 0) return null;
  const gifted = share(g.giftedBooked, g.giftedDeciding);
  const plain = share(g.plainBooked, g.plainDeciding);
  const high = gifted !== null && gifted > 0 && (plain === null || plain === 0 || gifted >= 2 * plain);
  const asked = `${formatCount(deciding)} ${deciding === 1 ? 'couple asked and has' : 'couples asked and have'} not booked.`;
  const rates = gifted !== null && plain !== null ? ` Couples you gave a gift to booked ${pct(gifted)} of the time; the rest, ${pct(plain)}.` : '';
  const ex = more.examplePoints && more.examplePoints.length > 0
    ? ` (${more.examplePoints.map((e, i) => (i === 0 ? `${e.name} is ${formatCount(e.points)} points` : `${e.name} ${formatCount(e.points)}`)).join(', ')})`
    : '';
  const next = giftPointsToNext(more.giftPoints);
  const reach = next ? `; ${formatCount(next.left)} more points reach ${BADGE_NAME.gifts_given} ${next.tier}` : '';
  return {
    key: 'give_gifts',
    title: 'Give a gift to the couples still deciding',
    body: `${asked}${rates} Give each of them a gift from your stock. Each gift earns one point for every ₱10 of its price${ex}, counted once their event is complete${reach}.`,
    impact: high ? 'high' : 'medium',
    impactLabel: high ? 'High impact' : 'Medium impact',
    ctaLabel: 'Give a gift',
    ctaHref: '/vendor-dashboard/shop/promote',
    weight: high ? 80 : 50,
  };
}

// ── The Invites graph (Invites Bronze) ────────────────────────────────────────────────────────────────────────────

/** One month of the Invites graph: suppliers invited that month, how many of them booked, how many completed an event. */
export type InviteMonth = { month: string; invited: number; booked: number; completed: number };

/** The graph's one line ("You invited 6 suppliers in the last 12 months; 3 booked, 2 completed an event."). */
export function invitesLine(months: readonly InviteMonth[]): string {
  const sum = (k: 'invited' | 'booked' | 'completed') => months.reduce((t, m) => t + m[k], 0);
  const invited = sum('invited');
  return `You invited ${formatCount(invited)} ${invited === 1 ? 'supplier' : 'suppliers'} in the last 12 months; ${formatCount(sum('booked'))} booked, ${formatCount(sum('completed'))} completed an event.`;
}
