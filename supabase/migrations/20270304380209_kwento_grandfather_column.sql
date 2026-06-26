-- 20270304380209_kwento_grandfather_column.sql
--
-- WHY (owner-locked 2026-06-26): Kwento became a paid SKU (migration
-- 20270302568299_papic_kwento_paywall.sql · KWENTO). The owner's locked rollout
-- is NEW EVENTS ONLY: every event that existed at the 2026-06-27 cutover keeps
-- Kwento free forever; events created after need the KWENTO entitlement (direct,
-- or via a bundle that grants it — e.g. PAPIC_UNLOCK). This adds the grandfather
-- flag the gates read (lib/kwento-access.ts eventKwentoEnabled:
-- kwento_free_grandfathered OR eventSkuActive(KWENTO)). No current couple loses
-- a shipped free feature.
--
-- New events default FALSE; existing events are flipped TRUE by the backfill
-- below, keyed to a FIXED cutover timestamp so a manual re-apply (ledger drift)
-- can NEVER wrongly grandfather an event created after the cutover.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS · fixed-literal backfill). NOT
-- AUTO-APPLIED: owner runs `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS kwento_free_grandfathered BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.kwento_free_grandfathered IS
  'TRUE = this event keeps Kwento free (grandfathered: created before the 2026-06-27 cutover when Kwento became a paid SKU). New events default FALSE and need the KWENTO entitlement (direct or via a bundle, e.g. PAPIC_UNLOCK).';

-- One-time backfill, re-run-safe: grandfather every event created before the
-- FIXED cutover literal. A fixed timestamp (not now()) makes a re-apply
-- idempotent — events created after the cutover stay FALSE no matter how many
-- times it runs. 2026-06-27 00:00 Manila = just past authoring, so every couple
-- live when the gate ships keeps Kwento free.
UPDATE public.events SET kwento_free_grandfathered = TRUE
WHERE created_at < TIMESTAMPTZ '2026-06-27 00:00:00+08'
  AND kwento_free_grandfathered = FALSE;

COMMIT;
