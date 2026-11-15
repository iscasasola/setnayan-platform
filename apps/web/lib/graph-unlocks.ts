/**
 * 🏅📊 EACH BADGE'S BRONZE OPENS ITS OWN GRAPHS (J5; owner 15 Nov — DECISION_LOG 7d6c8129 "all supplier badge + seal
 * prototypes approved … graphs by Bronze"; contract `Setnayan-specs/prototypes/supplier_badges_2026-11-15/badge-unlock_v6.html`).
 *
 *   Completed bookings Bronze → Your slow months · Dates you lost · Who brings you couples   (slow · lost · split)
 *   Five-star reviews Bronze  → What couples say · Replies that book                        (rep · replyvs)
 *   Gifts given Bronze        → Gifts given → bookings                                       (gifts, NEW)
 *   Trusted by Bronze         → none yet — its old graph "Which partners send you couples" no longer fits now that
 *                               Trusted by counts returning clients (50566f42); open item 10, nothing drawn until ruled.
 *   Invites Bronze            → none yet — which graphs it opens is unruled (open item 4).
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
 * ⚠ THE ONE ADAPTER (J0 #7753 builds the badge ladder in parallel). `BRONZE_STEP` copies the first step of each
 * badge's own ladder from J0's `SHOP_BADGE_STEPS` (lib/badge-tiers.ts on claude/badge-ladder-and-firing), and
 * `reachedBronze` accepts J0's reward keys (`<badge>:tier1`…`tier7`) as well as main's legacy completed-bookings keys
 * (`events:<step>`). When J0 lands, replace `BRONZE_STEP[b]` with `SHOP_BADGE_STEPS[b][0]` — nothing else moves.
 *
 * PURE: no I/O, no React. 🔒 lib/graph-unlocks.test.ts
 */
import type { GrowthRec } from './vendor-growth-recs';
import { formatCount } from './format-number';

/** The five shop badges (J0's `ShopBadgeKey`, by the same keys). */
export type UnlockBadge = 'completed_bookings' | 'five_star_reviews' | 'gifts_given' | 'trusted_by' | 'invites';

export const UNLOCK_BADGES: readonly UnlockBadge[] = ['completed_bookings', 'five_star_reviews', 'gifts_given', 'trusted_by', 'invites'];

/** The badge names everywhere (a33fd894: "Completed bookings · Five-star reviews · Gifts given · Trusted by · Invites"). */
export const BADGE_NAME: Readonly<Record<UnlockBadge, string>> = {
  completed_bookings: 'Completed bookings',
  five_star_reviews: 'Five-star reviews',
  gifts_given: 'Gifts given',
  trusted_by: 'Trusted by',
  invites: 'Invites',
};

/** What a count of each badge is a count OF (for "N more … to go"). */
const UNIT: Readonly<Record<UnlockBadge, [one: string, many: string]>> = {
  completed_bookings: ['completed booking', 'completed bookings'],
  five_star_reviews: ['five-star review', 'five-star reviews'],
  gifts_given: ['gift point', 'gift points'],
  trusted_by: ['returning client', 'returning clients'],
  invites: ['invited supplier', 'invited suppliers'],
};

/** ⚠ ADAPTER — the first step of each badge's own ladder (J0 `SHOP_BADGE_STEPS[badge][0]`, owner 15 Nov). */
export const BRONZE_STEP: Readonly<Record<UnlockBadge, number>> = {
  completed_bookings: 5,
  five_star_reviews: 50,
  gifts_given: 150,
  trusted_by: 1,
  invites: 1,
};

/** The graphs each badge's Bronze opens (badge-unlock_v6 `BADGES`, with today's two open items left empty). */
export const BADGE_GRAPHS: Readonly<Record<UnlockBadge, readonly string[]>> = {
  completed_bookings: ['slow', 'lost', 'split'],
  five_star_reviews: ['rep', 'replyvs'],
  gifts_given: ['gifts'],
  // Open item 10 (a33fd894): "Which partners send you couples" no longer fits Trusted by — none until ruled.
  trusted_by: [],
  // Open item 4 (7d6c8129): which graphs Invites opens is unruled — none until ruled.
  invites: [],
};

/** Graphs new with this change — a kept shop never "had" them; they sit at the end of the carousel, marked New. */
export const NEW_BADGE_GRAPHS: readonly string[] = ['gifts'];

/** Every graph a badge decides. */
export const BADGE_GATED_GRAPHS: readonly string[] = UNLOCK_BADGES.flatMap((b) => BADGE_GRAPHS[b]);

export type UnlockFacts = {
  /** The keep marker; null = not read. */
  kept: boolean | null;
  /**
   * Each badge's live count. `null` = the read FAILED (we don't know → graphs stay shown). ABSENT = this build has no
   * counter for the badge yet (five-star reviews and gift points are J0's, #7753) → decided by earned steps alone.
   */
  counts: Partial<Record<UnlockBadge, number | null>>;
  /** Every unrevoked badge reward key the shop holds; null = not read. */
  earned: readonly string[] | null;
};

export type BadgeGate = 'open' | 'locked' | 'unknown';

/** Has this badge EVER been earned at Bronze or above (keep what you had)? null = the earned list was not read. */
export function earnedBronze(badge: UnlockBadge, earned: readonly string[] | null): boolean | null {
  if (earned === null) return null;
  return earned.some((key) => {
    const [head, part] = key.split(':');
    if (head === badge && part !== undefined && /^tier[1-7]$/.test(part)) return true;
    // main's legacy completed-bookings steps ('events:<n>') start at 10 — above Bronze (5) — so any one of them is Bronze.
    if (badge === 'completed_bookings' && head === 'events' && part !== undefined && Number(part) >= BRONZE_STEP.completed_bookings) return true;
    return false;
  });
}

/**
 * One badge's gate: open (reached now, or ever earned) · locked (never earned, and the count — where this build has one —
 * is below Bronze) · unknown (a read failed: the earned list, or a count we do read).
 */
export function badgeGate(badge: UnlockBadge, facts: UnlockFacts): BadgeGate {
  const count = facts.counts[badge];
  if (typeof count === 'number' && Number.isFinite(count) && count >= BRONZE_STEP[badge]) return 'open';
  const ever = earnedBronze(badge, facts.earned);
  if (ever === true) return 'open';
  if (ever === null || count === null) return 'unknown';
  return 'locked';
}

/** How many more of the badge's unit to Bronze, in words ("2 more completed bookings to go"); null when unknown. */
export function toGoLine(badge: UnlockBadge, count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  const left = Math.max(0, BRONZE_STEP[badge] - count);
  if (left === 0) return null;
  const [one, many] = UNIT[badge];
  return `${formatCount(left)} more ${left === 1 ? one : many} to go`;
}

export type LockedBadge = { badge: UnlockBadge; name: string; graphs: readonly string[]; toGo: string | null };

export type GraphUnlocks = {
  /** Graphs NOT drawn (locked by a badge the shop has not reached). */
  hidden: ReadonlySet<string>;
  /** One entry per badge whose graphs are hidden — the carousel prints one plain line for each, under itself. */
  locked: readonly LockedBadge[];
  /** Graphs drawn because we could not tell (fail open) — for the page's own note, never shown as 0. */
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
    locked.push({ badge, name: BADGE_NAME[badge], graphs: shut, toGo: toGoLine(badge, facts.counts[badge]) });
  }
  return { hidden, locked, unsure };
}

/** The plain line that stands where a badge's graphs would be ("Five-star reviews Bronze opens What couples say …"). */
export function lockedLine(l: LockedBadge, titleOf: (graph: string) => string): string {
  const names = l.graphs.map(titleOf).join(' · ');
  return `${l.name} Bronze opens ${names}${l.toGo ? ` — ${l.toGo}` : ''}.`;
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

/**
 * The gifts graph's recommendation (badge-unlock_v6, settled 15 Nov): it FIRES when couples who asked are still deciding
 * and the shop has gift stock; it is HIGH impact when gifted couples book at least twice as often as the rest. Never
 * made up — no stock or nobody deciding means no task.
 */
export function giftsRec(g: GiftsToBookings | null): GrowthRec | null {
  if (!g) return null;
  const deciding = g.giftedDeciding + g.plainDeciding;
  if (deciding <= 0 || g.freeStock <= 0) return null;
  const gifted = share(g.giftedBooked, g.giftedDeciding);
  const plain = share(g.plainBooked, g.plainDeciding);
  const high = gifted !== null && gifted > 0 && (plain === null || plain === 0 || gifted >= 2 * plain);
  return {
    key: 'give_gifts',
    title: 'Give a gift to couples still deciding',
    body: `${formatCount(deciding)} ${deciding === 1 ? 'couple who asked is' : 'couples who asked are'} still deciding, and you have gifts in stock.`,
    impact: high ? 'high' : 'medium',
    impactLabel: high ? 'High impact' : 'Medium impact',
    ctaLabel: 'Give a gift',
    ctaHref: '/vendor-dashboard/shop/promote',
    weight: high ? 80 : 50,
  };
}
