-- ============================================================================
-- Papic v3 · brief PR-4 — events.papic_quality_tier (per-event fidelity tier)
-- ============================================================================
-- ONE column, two seams (Papic_Build_Brief_2026-07-17 ruling #2): the couple's
-- Papic setup surface (Studio → Papic) WRITES this column and the capture
-- ingest READS it — the same name on both sides, so a write/read mismatch
-- ("fake door") is impossible by construction.
--
-- Tier vocabulary (CHECK-constrained; see apps/web/lib/papic-fidelity.ts —
-- type PapicFidelityTier, distinct from adaptive-quality's NETWORK tier
-- PapicQualityTier in lib/papic-adaptive-quality.ts):
--   full_res        — keep the uploaded original 1:1, untouched (DEFAULT —
--                     exactly today's shipped behavior, so this migration is
--                     INERT on apply; auto-apply-on-merge safe).
--   optimal         — ingest downscales stills to ~4256px long edge (~12 MP,
--                     sharp to A3). Wedding recommended tier: guests' phones
--                     shoot ≈12 MP, so this is essentially native.
--   high_efficiency — ingest downscales stills to ~2560px long edge (~4 MP,
--                     screen/social/crowd). The Papic Lite tier.
--
-- Scope: STILL PHOTOS only. Clips are never transcoded server-side (Vercel has
-- no ffmpeg); clip fidelity is governed client-side at capture (1080p).
-- The tier applies at INGEST to captures recorded after it is set — existing
-- rows/objects are never re-processed retroactively.
--
-- Idempotent. No drops. Existing rows take the default = current behavior.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_quality_tier TEXT
    NOT NULL DEFAULT 'full_res'
    CHECK (papic_quality_tier IN ('full_res', 'optimal', 'high_efficiency'));

COMMENT ON COLUMN public.events.papic_quality_tier IS
  'Per-event Papic photo fidelity tier (brief PR-4). Written by the couple''s Papic setup surface, read by capture ingest — one column, both seams. full_res = originals kept 1:1 (default, legacy behavior) · optimal = ~4256px/~12MP ingest downscale (wedding recommended) · high_efficiency = ~2560px/~4MP (Papic Lite). Stills only — clips are never transcoded server-side. See apps/web/lib/papic-fidelity.ts.';
