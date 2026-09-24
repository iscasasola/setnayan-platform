/**
 * bench-unread.ts — the unread badge on the couple's team cards, decided in one
 * place.
 *
 * Owner, 2026-09-22: *"how about a counter badge instead on the category/ cards?"*
 * and, on what it counts: **"1. messages"** — unread messages in that supplier's
 * thread, not notifications and not "unanswered", which `lib/conversation-list.ts`
 * is careful to keep separate ("a supplier who has replied still has an unread row
 * when the couple wrote back; a conversation the supplier owes a reply to may be
 * perfectly well read").
 *
 * ─── THE RULE THIS MODULE EXISTS TO HOLD ────────────────────────────────────
 * 🔑 COUNT SUPPLIERS, NOT CARDS. Unread is per THREAD, i.e. per supplier, but one
 * supplier can occupy several cards: a venue package that covers catering, cake
 * and accommodation renders as a linked copy in each of those tiles. Summing per
 * card would report one unread message from that supplier as 1 in Venues AND 1 in
 * Catering & cake — a folder total of 2+ for a single message, worst exactly where
 * a package covers several categories, which is the common case.
 *
 * The rule is NOT invented here. `lib/shortlist-taxonomy.ts` already states it,
 * and `vendors/page.tsx` already applies it:
 *
 *     // A linked copy is the same booking shown again — count suppliers, not cards.
 *     pickCount += vendors.filter((x) => x.includedWith == null).length;
 *
 * So the rollups below filter `includedWith == null`, exactly as `pickCount` does.
 * A second dedupe rule would be a second source of truth about one fact.
 *
 * ⚠ THE CARD IS THE EXCEPTION, DELIBERATELY. A badge DOES appear on a linked copy,
 * because a couple looking at that card should see that there is something to read.
 * Only the TOTALS dedupe. `cardUnread` therefore ignores `includedWith` and
 * `rollupUnread` honours it — that asymmetry is the whole design, not an oversight.
 *
 * ─── AND "WE COULD NOT CHECK" IS NOT "NOTHING IS UNREAD" ────────────────────
 * A badge is precisely the surface where a refused read renders identically to a
 * clean inbox: both draw nothing. So `measured: false` propagates to `null`
 * everywhere, and `null` is NOT zero. The read that feeds this
 * (`readUnreadChatCountsByThread`) pages to the server's exact count and reports
 * `error` / `complete`; both collapse into `measured` here, once.
 */

/** The unread picture for one event, plus whether we actually know it. */
export type BenchUnread = {
  /** threadId → how many unread messages it holds. Absent key = zero unread. */
  countByThread: ReadonlyMap<string, number>;
  /**
   * FALSE means the read failed or was truncated — "we do not know".
   *
   * ⚠ A caller that treats `measured: false` as "nothing unread" has
   * reintroduced the defect. Every accessor below returns `null` in that case so
   * there is no number to render.
   */
  measured: boolean;
};

/** What a surface gets when nobody looked, or the look failed. */
export const UNREAD_UNKNOWN: BenchUnread = { countByThread: new Map(), measured: false };

/** Fold the paged read's `error` / `complete` into one `measured` flag. */
export function benchUnreadFrom(read: {
  countByThread: ReadonlyMap<string, number>;
  error: string | null;
  complete: boolean;
}): BenchUnread {
  return {
    countByThread: read.countByThread,
    // Both failure modes are the same fact on screen: a truncated read is a
    // wrong number, which is worse than no number.
    measured: read.error == null && read.complete === true,
  };
}

/**
 * Unread messages in ONE supplier's thread, or `null` when unknown.
 *
 * Ignores `includedWith` on purpose — see the header. A supplier with no thread
 * has nothing to be unread, which is a known zero, not an unknown.
 */
export function cardUnread(unread: BenchUnread, threadId: string | null): number | null {
  if (!unread.measured) return null;
  if (threadId == null) return 0;
  return unread.countByThread.get(threadId) ?? 0;
}

/**
 * Unread messages across a set of cards, counting each SUPPLIER once.
 *
 * Used for both the category tile and the folder head, so the two can never
 * disagree: a folder total is this function over the folder's cards, not a sum
 * of tile totals computed a different way.
 */
export function rollupUnread(
  vendors: ReadonlyArray<{ threadId: string | null; includedWith: string | null }>,
  unread: BenchUnread,
): number | null {
  if (!unread.measured) return null;
  let total = 0;
  for (const v of vendors) {
    // 🔑 The dedupe. A linked copy is the same booking shown again.
    if (v.includedWith != null) continue;
    if (v.threadId == null) continue;
    total += unread.countByThread.get(v.threadId) ?? 0;
  }
  return total;
}

/**
 * The badge's words, or `null` when there is no badge to draw.
 *
 * 🔑 RETURNING `null` IS THE MECHANISM, the same one `hiddenMoreLabel`
 * (`lib/capped-rows.ts`) and `unpricedNote` (`lib/your-team.ts`) use: with no
 * string there is no badge, so **a "0" badge is unrepresentable** rather than
 * merely discouraged, and so is a badge on an unmeasured read.
 *
 * Caps at "99+" because the badge sits inside a card's corner and a four-digit
 * count would resize it; the exact number past 99 changes no decision.
 */
export function unreadBadgeLabel(count: number | null): string | null {
  if (count == null) return null;
  if (!Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  return n > 99 ? '99+' : String(n);
}

/** Screen-reader text for the badge, or `null` when there is no badge. */
export function unreadBadgeAria(count: number | null): string | null {
  if (unreadBadgeLabel(count) == null) return null;
  const n = Math.floor(count as number);
  return `${n} unread ${n === 1 ? 'message' : 'messages'}`;
}
