-- ============================================================================
-- 20270803858253_egift_receive_qr_on_users.sql
--
-- E-GIFTS (Pabuya) — QR-DISPLAY ONLY (owner-clarified 2026-07-13: "we do not
-- offer transaction on e-gifts; they just share their own QR codes").
--
-- A user stores THEIR OWN receive-QR (their GCash / Maya / bank QR image). The
-- platform only DISPLAYS it — a giver scans it with their own banking app and
-- the money goes straight to the user's own account. Setnayan NEVER touches the
-- funds, reads no transaction, holds no balance, and keeps no ledger. This is an
-- asset-display feature, not a payments feature (consistent with the Pabuya lock
-- + the money-transmission carve-out).
--
-- Two columns on `users` (mirrors the existing profile_photo_url pattern):
--   • egift_qr_ref   — r2://bucket/key of the uploaded QR image (NULL = none)
--   • egift_qr_label — a short label the giver sees ("GCash", "Maya", …)
--
-- RLS: none added — `users` is already owner-scoped (a user manages only their
-- own row). Gated app-side behind egiftEnabled() (NEXT_PUBLIC_EGIFT, default
-- OFF) so the surface is dark until the owner turns it on. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS egift_qr_ref   TEXT,
  ADD COLUMN IF NOT EXISTS egift_qr_label TEXT;

COMMENT ON COLUMN public.users.egift_qr_ref IS
  'r2:// ref of the user''s OWN receive-QR image (GCash/Maya/bank). QR-DISPLAY ONLY — Setnayan never touches funds. Gated app-side behind egiftEnabled().';

COMMIT;
