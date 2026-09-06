/**
 * category-archive.ts — the PURE core of "removing a category archives its
 * conversations, and restoring it brings back exactly the ones it archived".
 *
 * ── THE RULING (owner 2026-09-06) ───────────────────────────────────────────
 * *"how about archive. just means, that category will no longer be on their
 * choices to build"* — then, asked directly: *"yes archive the conversations
 * too."*
 *
 * ── ARCHIVE, NEVER DELETE ───────────────────────────────────────────────────
 * This reuses the mechanism `withdrawInquiry` already established on
 * 2026-07-24: stamp `chat_threads.archived_at` (migration 20270926679942).
 * That decision's reasoning applies here unchanged and is worth restating,
 * because it is the reason a delete was refused: **the conversation is the
 * dispute/evidence record and the source of the couple-confirmed booking
 * amount**, and the vendor is the other party to it. There is no DELETE policy
 * on `chat_threads` at all — a hard delete would be denied by RLS anyway.
 *
 * ── THE HARD PROBLEM: RESTORE MUST NOT RESURRECT ────────────────────────────
 * 🔑 **A blanket un-archive on restore is a DATA-LOSS-SHAPED BUG in reverse.**
 * If restoring a category simply NULLed `archived_at` for every thread in it,
 * it would also un-archive threads the couple had deliberately withdrawn weeks
 * earlier, with `withdrawInquiry`, for their own reasons. Their choice would be
 * silently overwritten by an unrelated action.
 *
 * So the exclusion's own `decided_at` is used as a CORRELATION STAMP: every
 * thread this removal archives is stamped with the exact timestamp stored on
 * the `event_category_decisions` row, and the restore un-archives only threads
 * carrying that exact stamp. A thread the couple archived themselves has a
 * different timestamp and is left exactly as they left it.
 *
 * This needs NO new column: `event_category_decisions.decided_at` already
 * exists (migration 20270110320013) and `excludeTileFromPlan` already writes
 * it. The rule that keeps it sound is that the SAME string must be written to
 * both places — enforced by `archiveStamp()` returning one value used twice.
 *
 * ── WHAT CANNOT BE ARCHIVED HERE ────────────────────────────────────────────
 * A category holding a LOCKED vendor cannot be removed at all — the guard
 * predates this (`canRemoveTileFromPlan`, and `excludeTileFromPlan` refusing
 * with `REMOVE_BLOCKED_LOCKED`, fail-closed). So this module can never archive
 * a booked supplier's thread: by the time it runs, the category is proven
 * unlocked. That is a safety property of the ORDER of operations, and the
 * caller must keep the guard first.
 */

/** One `event_vendors` row, as this module needs it. */
export type CategoryVendorRow = {
  /** NULL for an off-platform pick the couple typed in — it has no thread. */
  marketplace_vendor_id: string | null;
};

/** One `chat_threads` row, as this module needs it. */
export type ArchivableThread = {
  thread_id: string;
  vendor_profile_id: string;
  /** NULL = active. Non-null = already archived, by whoever, whenever. */
  archived_at: string | null;
};

/**
 * The single timestamp written BOTH to `event_category_decisions.decided_at`
 * and to every `chat_threads.archived_at` this removal stamps. One call, one
 * value, two writes — if these ever diverge the restore silently stops
 * matching and the couple's conversations never come back.
 */
export function archiveStamp(now: Date = new Date()): string {
  return now.toISOString();
}

/**
 * Which threads a category removal should archive.
 *
 *   • only threads whose vendor sits in this category (by marketplace profile
 *     id — an off-platform pick has none and is skipped),
 *   • only threads that are currently ACTIVE. Re-stamping an already-archived
 *     thread would rewrite a timestamp the couple's own withdrawal owns, and a
 *     later restore would then un-archive something they archived on purpose.
 */
export function threadsToArchive(args: {
  vendors: ReadonlyArray<CategoryVendorRow>;
  threads: ReadonlyArray<ArchivableThread>;
}): string[] {
  const inCategory = new Set(
    args.vendors.map((v) => v.marketplace_vendor_id).filter((id): id is string => !!id),
  );
  const out: string[] = [];
  for (const t of args.threads) {
    if (t.archived_at !== null) continue;
    
    if (!inCategory.has(t.vendor_profile_id)) continue;
    if (out.includes(t.thread_id)) continue;
    out.push(t.thread_id);
  }
  return out;
}

/**
 * Which threads a category RESTORE should un-archive: exactly those carrying
 * this removal's stamp. Anything archived at a different moment — a manual
 * `withdrawInquiry`, or an earlier removal of the same category — is left
 * alone, because it represents a different decision by a different actor.
 */
export function threadsToRestore(args: {
  threads: ReadonlyArray<ArchivableThread>;
  stamp: string | null;
}): string[] {
  if (!args.stamp) return [];
  return args.threads
    .filter((t) => t.archived_at !== null && t.archived_at === args.stamp)
    .map((t) => t.thread_id);
}
