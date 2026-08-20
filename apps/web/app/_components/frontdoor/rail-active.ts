/**
 * rail-active.ts — which ONE rail row is lit, for a given URL.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * The front-door rail shipped with `Home` hardcoded `data-on="true"` and no
 * active-route logic of any kind. That is harmless while the rail renders on
 * exactly one URL (`/`), and it becomes wrong on every page the moment the
 * same rail is mounted inside the app: all 296 converted pages would light
 * "Home", and NOTHING WOULD THROW. A literal is not a match.
 *
 * ─── WHY A "WHICH ONE" FUNCTION AND NOT A PER-ROW BOOLEAN ────────────────
 * Asking each row "are you active?" independently DOUBLE-LIGHTS, because the
 * shipped matcher is prefix-based by contract: on `/dashboard/library` the
 * href `/dashboard` matches (prefix) AND `/dashboard/library` matches
 * (exact). Two lit rows is not a smaller bug than zero — it tells the reader
 * they are in two places at once.
 *
 * So this resolves a SINGLE winner: among every row that matches, the most
 * SPECIFIC one wins. Specificity is (href path length, then number of query
 * params the href declares), which is the same ordering a human would read —
 * `/dashboard/library` beats `/dashboard`, and `/explore?folder=x` beats
 * `/explore`.
 *
 * ─── THE MATCHING ITSELF IS NOT REIMPLEMENTED ────────────────────────────
 * `matchesPath` in `../nav/match-path.ts` is THE shipped contract, unit-tested
 * in `match-path.test.ts` and used by all three doorways. This file CALLS it.
 * Rewriting the trailing-slash rule here would be a second answer to one
 * question, and the two would drift.
 */

import { matchesPath } from '../nav/match-path';
import type { ParamGetter } from '../nav/match-path';

/**
 * A rail row that takes part in active matching.
 *
 * `key` is stable and is what the caller compares against — never the label,
 * which an admin can rename from the nav registry at any time.
 */
export type RailMatchRow = {
  key: string;
  href: string;
  /** Claim a family of sub-routes. Defaults to the href's pathname. */
  matchPrefix?: string;
  /**
   * Claim this URL and NOTHING BENEATH IT.
   *
   * The shipped matcher is prefix-based by contract, and `matchPrefix` exists
   * only to WIDEN. One row needs the opposite: `/dashboard` is the events
   * board, and every account spoke lives under it — profile, notifications,
   * Alaala, your story. Left prefix-matching, the events row lights on all of
   * them, so a person reading their own settings is told they are looking at
   * their events.
   *
   * This is not a second matching algorithm: for a query-less href, the
   * shipped rule with an unmatchable prefix reduces to exactly this equality.
   * It is spelled out because a sentinel prefix would have been a trick.
   */
  exact?: boolean;
};

/** Split an href into its pathname and the count of params it declares. */
function specificityOf(href: string): [pathLength: number, declaredParams: number] {
  const q = href.indexOf('?');
  if (q === -1) return [href.length, 0];
  return [q, new URLSearchParams(href.slice(q + 1)).size];
}

/**
 * THE rail's matchable rows, for one person.
 *
 * 🔑 THIS LIVES HERE, NOT INSIDE THE COMPONENT, SO IT CAN BE TESTED DIRECTLY.
 * A first cut built this list inline in the shell and the test declared its
 * own copy — so a mutation that deleted `exact: true` from the REAL list
 * passed every behaviour test, because those tests were exercising the test's
 * list. Testing the primitive is not testing the caller. Now there is one
 * list, and the tests call it.
 *
 * 🪤 THE MARKETPLACE FOLDERS AND THE STUDIO TOOLS ARE DELIBERATELY ABSENT.
 * They point at `/explore?folder=…` and the eight public doorways — surfaces
 * no converted route can reach, so they can never be the current page and are
 * never lit. Telling them apart needs the current QUERY; that arrives with the
 * slice that converts `/explore`. A row that cannot be right is better left
 * unlit than guessed.
 */
export function railMatchRows(who: {
  signedIn: boolean;
  hasShop: boolean;
  isAdmin: boolean;
}): RailMatchRow[] {
  return [
    { key: 'home', href: '/' },
    /*
      🔑 NO 'stories' ROW — THE RAIL NO LONGER HAS ONE (owner 2026-08-20).
      Stories folded into the chips over the feed, so `/realstories` is reached
      from the shelf HEADING, not from a destination. It therefore lights
      nothing, which is the documented correct answer: `activeRailKey` returns
      null and null renders as "no row lit". Do NOT map it onto 'home' to fill
      the gap — that is the exact defect this file already records, a row lit
      on a URL that is not its own.
    */
    ...(who.signedIn ? [{ key: 'find', href: '/explore' }] : []),
    ...(who.signedIn
      ? [
          // EXACT: every account spoke lives under /dashboard, so a prefix
          // match here lights "your events" while you read your settings.
          { key: 'events', href: '/dashboard', exact: true },
          { key: 'alaala', href: '/dashboard/library' },
          // Longest-prefix wins, so this beats the exact-only '/dashboard' row.
          { key: 'year', href: '/dashboard/year' },
          { key: 'people', href: '/dashboard/people' },
          { key: 'story', href: '/dashboard/creator' },
        ]
      : []),
    ...(who.hasShop ? [{ key: 'shop', href: '/vendor-dashboard' }] : []),
    ...(who.isAdmin ? [{ key: 'hq', href: '/admin' }] : []),
  ];
}

/**
 * The key of the one row that should read as active, or `null` when the
 * current URL belongs to no row.
 *
 * `null` IS A REAL ANSWER and must render as "no row lit" — never as a
 * fallback to the first row. A person on a page the rail does not list is
 * better told nothing than told they are somewhere they are not.
 *
 * `currentParams` may be omitted. The shipped matcher documents that as "no
 * params present", which is the correct reading for a rail whose only
 * query-carrying rows (the marketplace folders) point at a surface no
 * converted route can reach.
 */
export function activeRailKey(
  rows: ReadonlyArray<RailMatchRow>,
  pathname: string,
  currentParams?: ParamGetter | null,
): string | null {
  let bestKey: string | null = null;
  let bestScore: [number, number] = [-1, -1];

  for (const row of rows) {
    const matched = row.exact
      ? pathname === row.href.split('?')[0]
      : matchesPath(row, pathname, currentParams);
    if (!matched) continue;
    const score = specificityOf(row.href);
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      bestScore = score;
      bestKey = row.key;
    }
  }

  return bestKey;
}
