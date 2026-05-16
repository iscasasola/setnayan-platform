-- ============================================================================
-- Iteration 0012 Papic — events.papic_storage_target
-- ============================================================================
-- Created 2026-05-16 alongside the Drive OAuth wiring for Papic (Agent B of
-- the 2026-05-16 V1 scope expansion that wires real OAuth on the V1.5+
-- scaffold setup pages). The shared `oauth_grants` table foundation already
-- shipped in 20260516260000_oauth_grants_per_couple.sql (PR #95, sibling
-- Agent A). This migration adds the column the Papic capture pipeline reads
-- to decide where each photo is written.
--
-- Design decision (LOCKED 2026-05-16):
--   `setnayan_r2`       — DEFAULT. Couple writes photos to Setnayan's
--                          managed R2 storage. Fast, reliable, no quota
--                          management for the couple. Recommended.
--   `google_drive_only` — Couple opted into using their own Google Drive
--                          folder ONLY. Requires an active oauth_grants row
--                          with provider='drive' for the same event_id.
--                          Trades reliability for ownership: subject to
--                          Drive's per-user API quota + the couple's Drive
--                          storage cap (a typical wedding produces 30-60 GB;
--                          most free Drive accounts won't fit).
--
-- This deviates from the original 0012 spec's "T+30d transfer" model
-- (Setnayan keeps photos for 30 days then bulk-pushes to the couple's
-- Drive). The 2026-05-16 owner directive changed the model to "real-time
-- during the event for BOTH options" with the storage target as a hard
-- toggle: R2 is the primary by default; couples who want full ownership /
-- no Setnayan-copy can flip to `google_drive_only`. See COWORK_INBOX.md
-- entry for the spec corpus catch-up.
--
-- The Papic capture pipeline itself (camera SDK pairing, face detection,
-- adaptive compression, upload) remains V1.5+ per the spec corpus; this
-- migration just makes the seam ready for it.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_storage_target TEXT
    NOT NULL DEFAULT 'setnayan_r2'
    CHECK (papic_storage_target IN ('setnayan_r2', 'google_drive_only'));

COMMENT ON COLUMN public.events.papic_storage_target IS
  'Where Papic photos write to. Default setnayan_r2 (recommended, fast, reliable). google_drive_only means couple opted out of R2 and accepted Drive throttling + quota tradeoffs. Requires active oauth_grants row with provider=drive when set to google_drive_only. See iteration 0012.';
