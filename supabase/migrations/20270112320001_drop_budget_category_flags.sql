-- Drop budget_category_flags — the retired 2-state Flag table (2026-06-16).
--
-- The legacy Pin/Flag Build stored a couple's "Setnayan should suggest this"
-- markers in `budget_category_flags` (one row per flagged plan group). The
-- 3-State Build (Locked/Auto/Excluded) replaced that whole mechanism with
-- `event_category_build_state`, and PR #1568 deleted the last code that read or
-- wrote this table (build-flags-actions.ts + the page.tsx Flag query). With the
-- flag retired and the 3-State Build live as the only Build path, the table is
-- pure dead weight.
--
-- Audited before dropping (2026-06-16): 0 code references (deleted in #1568),
-- 0 incoming foreign keys, 0 views/rules depend on it, and the only stored data
-- was stale Flag markers (the new system supersedes them). So a plain DROP is
-- safe — no CASCADE needed; the table's own RLS policies + indexes drop with it.
--
-- IF EXISTS so this is idempotent / a no-op if the table was already removed.

DROP TABLE IF EXISTS public.budget_category_flags;
