-- a_suppliers_photos_compress_too
-- ============================================================================
-- A SUPPLIER'S PHOTOGRAPHS SHRINK LIKE EVERYONE ELSE'S. Owner, 2026-08-24:
-- *"compress it as well."*
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- Every other photograph on this platform is stored twice: the full-resolution
-- original, and a compressed AVIF web copy. After the retention window the
-- original is REPLACED BY the web copy — the photograph is never deleted, only
-- its resolution changes (owner, twice: *"again. not delete. just compress"*).
--
-- `vendor_papic_captures` had NONE of the columns that model needs, so a
-- supplier's photographs were outside it entirely: no web copy, nothing for the
-- sweep to fall back to, and therefore full resolution in storage forever. The
-- public `/privacy` notice describes a retention model those files did not obey.
--
-- ⚠ AND THE ABSENCE WAS SILENT IN THE SAFE DIRECTION, WHICH IS WHY IT LASTED.
-- `papic-fullres-drop.ts` only ever considers rows that already HAVE a web copy
-- (`display_r2_key`/`clip_web_r2_key` NOT NULL). A table with no such column is
-- not a table it drops from — it is a table it cannot see. Nothing errored,
-- nothing was lost, and the bill just grew.
--
-- ── WHAT THIS ADDS, AND WHY EACH ONE ────────────────────────────────────────
-- Exactly the columns `persistDerivativeRefs` writes and the drop sweep reads —
-- no more. Copied from `papic_guest_captures`, which is the closest twin (a
-- non-couple actor's captures at somebody else's celebration).
--
--   display / tile / thumb keys  the three AVIF sizes the shared generator
--                                already produces (1280 / 640 / 320 long edge).
--                                `display` is the copy that REPLACES the
--                                original; the other two exist because a wall
--                                tile served from a 320px thumb is the one
--                                visibly soft square in a sharp grid.
--   *_bytes                      byte accounting. `display_bytes / orig_bytes`
--                                IS the compression ratio, and without
--                                `orig_bytes` the sweep cannot report what it
--                                reclaimed.
--   full_res_dropped_at          the stamp that says "the original is gone and
--                                the web copy is now the photograph". Readers
--                                use it to stop offering a download that would
--                                404.
--   preserved_at                 the couple paid to keep this one sharp. A
--                                candidate carrying it is never dropped.
--   full_res_drop_deferred_at    the anti-starvation cursor. Without it a
--                                Drive-deferred row sits at the head of the
--                                oldest-N window forever and blocks newer
--                                drops behind it.
--
-- ── WHAT THIS DELIBERATELY DOES NOT ADD ─────────────────────────────────────
-- 🛑 `clip_web_r2_key` / `clip_web_bytes` — the transcoded VIDEO web copy. On
-- the couple's side that file is produced by the GUEST'S OWN BROWSER and
-- uploaded as a finished object, because Vercel has no ffmpeg and we pay ₱0 of
-- compute for it. The supplier capture path has no such transcode, and adding
-- the columns without it would be a promise with no writer — the exact
-- "gate with no handle" shape this repo has now recorded six times.
--
-- So a supplier's CLIP keeps its original video, and that is stated rather than
-- hidden. It is also bounded: a vendor clip is capped at 10 seconds, and a 10s
-- clip measured on this platform is 0.25–1.48 MB — smaller than one phone photo.
-- The still frame of that clip DOES compress (the generator derives it from the
-- existing poster), so the gallery side is covered either way.
--
-- ── SAFE BY CONSTRUCTION, NOT BY SEQUENCING ─────────────────────────────────
-- Adding these columns cannot cause a drop on its own: a row is a candidate
-- only once `display_r2_key` is NOT NULL, and only the derivative generator
-- writes it — after it has successfully uploaded the copy that will replace the
-- original. A failed compression leaves the column NULL, which means the
-- original is simply kept. The failure mode is a bigger bill, never a lost
-- photograph.
--
-- Prod holds 0 supplier captures and the capture surface is flag-dark, so
-- nothing is compressed or dropped by this today.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS throughout. No backfill — there is
-- nothing to backfill, and re-deriving a web copy for a row that has none is
-- what the generator does on capture.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_papic_captures
  ADD COLUMN IF NOT EXISTS display_r2_key            TEXT,
  ADD COLUMN IF NOT EXISTS tile_r2_key               TEXT,
  ADD COLUMN IF NOT EXISTS thumb_r2_key              TEXT,
  ADD COLUMN IF NOT EXISTS orig_bytes                BIGINT,
  ADD COLUMN IF NOT EXISTS display_bytes             BIGINT,
  ADD COLUMN IF NOT EXISTS tile_bytes                BIGINT,
  ADD COLUMN IF NOT EXISTS thumb_bytes               BIGINT,
  ADD COLUMN IF NOT EXISTS full_res_dropped_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preserved_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS full_res_drop_deferred_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_papic_captures.display_r2_key IS
  'The compressed AVIF web copy (long edge 1280) that REPLACES the full-res original once the retention window passes — so the photograph is never deleted, only its resolution changes. Written by generatePhotoDerivatives (or, for a clip, set to the poster ref by generateClipThumb). NULL means no web copy exists yet, and a NULL row is never a drop candidate: a failed compression keeps the original, which costs storage and never a photograph. Added 2026-08-24 (owner: "compress it as well") — before this, supplier captures had no web copy at all and sat at full resolution indefinitely, outside the retention model the public privacy notice describes.';

COMMENT ON COLUMN public.vendor_papic_captures.full_res_dropped_at IS
  'Stamped when the full-res original has been deleted and display_r2_key is now the photograph. Readers use it to stop offering a download that would 404. Only papic-fullres-drop.ts writes it, and only after the R2 delete succeeded.';

COMMENT ON COLUMN public.vendor_papic_captures.preserved_at IS
  'The couple paid to keep this one sharp — a candidate carrying it is never dropped. Mirrors papic_photos / papic_guest_captures so preservation cannot apply to some of a celebration''s photographs and not others.';

COMMENT ON COLUMN public.vendor_papic_captures.full_res_drop_deferred_at IS
  'Anti-starvation cursor: re-stamped each pass a row is skipped (e.g. a Drive copy still in flight) so it rotates to the back of the oldest-N window instead of permanently occupying the head and blocking newer drops.';

COMMIT;
