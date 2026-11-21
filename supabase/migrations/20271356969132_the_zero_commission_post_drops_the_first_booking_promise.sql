-- ============================================================================
-- 📰 THE ZERO-COMMISSION POST NO LONGER PROMISES A FREE FIRST BOOKING
-- ============================================================================
-- Owner 2026-11-20/21 (DECISION_LOG "BOOKING FEE: 5% OF THE FIRST ₱100,000 …" and "OWNER READ THE THREE MONEY
-- CARDS — #8061 YES"): there is NO free first booking for a client Setnayan brings. The Journal post
-- `what-zero-commission-means-for-couples` was imported into `creator_chapters` by 20271355899662 (already applied)
-- and still says "a supplier’s first booking from Setnayan is on us". An applied migration is never edited, so this
-- NEW migration removes that one clause from that one post; `lib/blog-batches/december-news.ts` carries the same
-- edit, and `lib/journal-edits-after-import.ts` lists it so lib/journal-move.test.ts still proves the import file is
-- what the source generated.
--
-- Scope: ONE row (is_journal, that slug). Idempotent: replace() of a clause that is no longer there is a no-op, and
-- the WHERE only matches while the clause is present, so a re-run (or a post an admin already rewrote) touches nothing.
-- ============================================================================

BEGIN;

-- A busy table: wait at most 5 s for its lock, then fail (deploy-prod fails closed; the next run applies it).
SET LOCAL lock_timeout = '5s';

UPDATE public.creator_chapters
   SET body = replace(
         body,
         $old$unless the supplier is the first to bring the event: a supplier’s first booking from Setnayan is on us, a supplier who is the first$old$,
         $new$unless the supplier is the first to bring the event: a supplier who is the first$new$
       ),
       updated_at = now()
 WHERE is_journal IS TRUE
   AND slug = 'what-zero-commission-means-for-couples'
   AND position($old$a supplier’s first booking from Setnayan is on us, $old$ IN body) > 0;

COMMIT;
