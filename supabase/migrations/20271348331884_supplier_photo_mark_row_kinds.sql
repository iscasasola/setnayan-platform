-- supplier photo mark row kinds
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔏 THE NEW SUPPLIER PHOTO MARK (owner-approved 2026-11-15, DECISION_LOG "APPROVED — THE NEW SUPPLIER PHOTO MARK,
-- APP-WIDE" + "THE PHOTO-MARK QR GOES ON EVERY SHOP'S PHOTOS, VERIFIED OR NOT"). It supersedes the Seal and plate
-- (2026-11-04) on every supplier photo, and the owner ruled existing photos are RE-MARKED from their clean private
-- copy through the re-mark path that table already serves (`lib/supplier-photo-remark.server.ts`).
--
-- WHAT THIS CHANGES — the allowed values only (a LOOSENING; no row is written):
--   supplier_photo_originals.mark_kind records what a public copy carries. It knew two looks of ONE design
--   ('setnayan' · 'verified'). It now also knows the new design's two ('row' · 'row-verified'), so the re-mark job
--   can tell a photo still carrying the Seal and plate from one carrying the row — and only the row kinds are ever
--   desired now, so every old copy reads as pending and is re-marked, idempotently, by the same job.
--
-- 🛑 NOTHING IS RE-MARKED BY THIS FILE. Rewriting public bytes is the job's `--apply`, an owner decision (its own
-- header); a session runs its dry run only.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.supplier_photo_originals
  DROP CONSTRAINT IF EXISTS supplier_photo_originals_mark_kind_chk;
ALTER TABLE public.supplier_photo_originals
  ADD CONSTRAINT supplier_photo_originals_mark_kind_chk
  CHECK (mark_kind IN ('setnayan', 'verified', 'row', 'row-verified'));

COMMENT ON COLUMN public.supplier_photo_originals.mark_kind IS
  'What the public copy carries: ''setnayan'' / ''verified'' = the Seal and plate (2026-11-04); ''row'' / ''row-verified'' = the new supplier photo mark (2026-11-15: the bottom row, the QR on every shop, the shop logo circle when verified). Only the row kinds are desired now, so the re-mark job re-stamps every Seal-and-plate copy from its clean original.';

COMMIT;
