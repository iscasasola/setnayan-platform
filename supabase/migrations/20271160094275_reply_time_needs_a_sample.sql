-- reply_time_needs_a_sample
-- ============================================================================
-- "USUALLY RESPONDS IN 2h" IS A CLAIM ABOUT A PATTERN. Give it a sample.
--
-- `vendor_activity_stats.avg_response_minutes` is the MEDIAN of
-- (vendor_first_reply_at − created_at) across the threads a shop has replied
-- to. The public marketplace card renders it as a badge — and the row records
-- the median without recording how many replies it came from, so nothing
-- downstream can tell one reply from fifty.
--
-- Two consequences, both live on a public page before this migration:
--
--   1. NO SAMPLE FLOOR. One inquiry answered in twelve minutes, once, earns a
--      shop the words "Usually responds in 12m" in front of every couple
--      browsing. "Usually" is a claim about a habit; a single event is not one.
--
--   2. THE "NO DATA" SENTINEL IS A NUMBER. `lib/vendor-activity.ts` writes 0
--      when NO thread has a reply yet, and `isFirstLookEligible` correctly
--      reads `<= 0` as unknown — but the marketplace card only checks
--      `!== null`, so a shop that has never answered anybody passes
--      `0 < 240` and is advertised as **"Usually responds in 0m"**. The
--      strongest possible claim, made for the weakest possible reason, by the
--      one consumer that never learned the convention.
--
-- 🔑 A SENTINEL HELD IN ONE CONSUMER'S HEAD IS NOT A RULE. Two readers of one
-- number disagreed about what 0 meant, and the one that got it wrong is the one
-- couples read. The count below replaces the convention with a fact: the sample
-- size travels WITH the median, so "how many is this based on?" stops being
-- something a caller has to remember.
--
-- ── WHY A COLUMN AND NOT A DERIVATION ───────────────────────────────────────
-- The median is already computed and stored by the same pass that would count
-- the threads (`refreshVendorActivityStats`), from rows it has already read.
-- Deriving the count separately at render time would mean a second query per
-- card on a gallery page, against `chat_threads` — a table the marketplace card
-- has no business reading — and it would be a second definition of "replied"
-- free to drift from the one the median uses.
--
-- ── FAIL-CLOSED BY DEFAULT ──────────────────────────────────────────────────
-- DEFAULT 0, so every existing row starts below the floor and the badge is
-- withheld until the stats pass writes a real count. A claim we cannot
-- substantiate is not made in the meantime. That pass runs on ordinary chat
-- activity, so it self-heals with no backfill and no cron.
--
-- ⚠ NOT BACKFILLED ON PURPOSE. A backfill would have to re-derive "replied"
-- from `chat_threads` here, in SQL, which is exactly the second definition this
-- migration exists to avoid. Prod holds 0 chat threads and 0 stats rows, so
-- there is nothing to backfill anyway.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_activity_stats
  ADD COLUMN IF NOT EXISTS replied_thread_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.vendor_activity_stats.replied_thread_count IS
  'How many inquiry threads this shop has actually replied to — the SAMPLE SIZE behind avg_response_minutes, which is a median over exactly these threads. Added 2026-08-24 because the public marketplace badge said "Usually responds in Xm" off a sample of one, and said "Usually responds in 0m" for a shop that had never replied at all (0 is the no-data sentinel in avg_response_minutes, honoured by isFirstLookEligible and not by the card). A median without its N cannot be judged by any caller, so the N now travels with it. DEFAULT 0 = fail closed: below the floor no badge is shown, and refreshVendorActivityStats fills it in on ordinary chat activity — deliberately NOT backfilled, because re-deriving "replied" in SQL would create the second definition this column exists to prevent.';

COMMIT;
