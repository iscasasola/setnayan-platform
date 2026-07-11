-- Papic storage byte-accounting (WS4 telemetry · owner 2026-07-11)
-- (0012_papic build plan · Pricing.md § 2.1 storage-tail governor)
--
-- Records the REAL byte sizes of every capture's original + its two web-copy
-- derivatives (display 1280-JPEG, thumb 320-JPEG), captured at derivative-gen
-- time. Purpose: measure the actual web-copy/original ratio and per-event storage
-- so the PROVISIONAL numbers the councils flagged as unmeasured — the ~8% web-copy
-- assumption, the 40 GB/event soft ceiling, the ₱/GB cost — get LOCKED from real
-- data (first ~50 Unli events) instead of a modelled guess. Pure measurement: no
-- behaviour change, nothing gated, nothing dropped.
--
-- Nullable + additive: legacy rows stay NULL (unmeasured); new captures populate
-- as derivatives generate. bigint = bytes (a maxed 50 GB/cam·day fits easily).

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS orig_bytes    bigint,
  ADD COLUMN IF NOT EXISTS display_bytes bigint,
  ADD COLUMN IF NOT EXISTS thumb_bytes   bigint;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS orig_bytes    bigint,
  ADD COLUMN IF NOT EXISTS display_bytes bigint,
  ADD COLUMN IF NOT EXISTS thumb_bytes   bigint;

COMMENT ON COLUMN public.papic_photos.orig_bytes IS
  'Byte size of the full-res original (r2_object_key), recorded at derivative-gen. NULL = pre-telemetry or not yet processed. WS4 storage telemetry.';
COMMENT ON COLUMN public.papic_photos.display_bytes IS
  'Byte size of the display web-copy derivative (long-edge 1280 JPEG). The forever-hosted web copy; display_bytes/orig_bytes measures the real "~8%" ratio.';
COMMENT ON COLUMN public.papic_photos.thumb_bytes IS
  'Byte size of the thumb derivative (long-edge 320 JPEG).';
COMMENT ON COLUMN public.papic_guest_captures.orig_bytes IS
  'Byte size of the full-res original, recorded at derivative-gen. NULL = pre-telemetry. WS4 storage telemetry.';
COMMENT ON COLUMN public.papic_guest_captures.display_bytes IS
  'Byte size of the display web-copy derivative (long-edge 1280 JPEG). Forever-hosted web copy.';
COMMENT ON COLUMN public.papic_guest_captures.thumb_bytes IS
  'Byte size of the thumb derivative (long-edge 320 JPEG).';
