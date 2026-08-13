-- tile_derivative_refs — a THIRD photo derivative, sized for wall tiles.
--
-- WHY THIS EXISTS (measured, 2026-08-13, against these very tables in prod):
--
--     avg thumb_bytes   =   4 KB   (long-edge  320, AVIF q50)
--     avg display_bytes =  96 KB   (long-edge 1280, AVIF q60)
--     max display_bytes = 780 KB
--     ratio             =  27x
--
-- The Alaala memory wall renders 105-192 CSS px squares = 310-383 DEVICE px.
-- It first served `thumb_r2_key`, and the owner said "the photos are
-- pixelated" -- correctly: `object-cover` on an aspect-square tile scales a
-- LANDSCAPE thumb by its 240px HEIGHT, so every breakpoint upscaled 1.3x-1.6x
-- from a quality-50 source. PR #4399 switched the wall to `display_r2_key`,
-- which is sharp but costs 27x the bytes per tile.
--
-- NEITHER EXISTING SIZE FITS. 320 is too small for the tile; 1280 is 3-4x
-- larger than any tile renders. 640 long-edge covers the largest tile as a
-- 1.25x DOWNSCALE, and bytes scale with pixel count (640^2/1280^2), so it
-- lands at roughly a QUARTER of display -- sharp and light.
--
-- Both existing sizes stay exactly as they are: several surfaces legitimately
-- want each. The dense day-of venue grid keeps the 320px copy on purpose.
--
-- IDEMPOTENT: IF NOT EXISTS on every add, so a replay or a re-push is a no-op.

-- ── papic_photos ───────────────────────────────────────────────────────────
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS tile_r2_key text,
  ADD COLUMN IF NOT EXISTS tile_bytes  bigint;

-- ── papic_guest_captures ───────────────────────────────────────────────────
-- The wall reads BOTH capture tables; a guest's photo is a memory too.
ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS tile_r2_key text,
  ADD COLUMN IF NOT EXISTS tile_bytes  bigint;

-- ── Column comments ────────────────────────────────────────────────────────
-- APPLIED MIGRATIONS ARE NEVER EDITED, so the comment a reader actually
-- queries lives on the object rather than only in this file. (`live_photo_wall
-- _visibility` was misdescribed by an applied migration for months and that
-- misreading is what let a defect live.)
COMMENT ON COLUMN public.papic_photos.tile_r2_key IS
  'r2:// ref to the AVIF tile derivative (long-edge 640, q55) - the copy grid '
  'walls render. Sits between thumb_r2_key (320, dense peek strips) and '
  'display_r2_key (1280, lightbox/full view). NULL on rows captured before '
  '2026-08-13; readers fall back to display_r2_key, which is sharp but ~4x '
  'heavier. Resolve via resolveLargeStillRef() - never read this column '
  'directly, or the dropped-original and never-an-MP4 rules are bypassed.';
COMMENT ON COLUMN public.papic_photos.tile_bytes IS
  'Byte size of the tile derivative (storage telemetry, matching '
  'display_bytes/thumb_bytes). NULL = unmeasured, never 0.';
COMMENT ON COLUMN public.papic_guest_captures.tile_r2_key IS
  'r2:// ref to the AVIF tile derivative (long-edge 640, q55). Twin of '
  'papic_photos.tile_r2_key - see that comment for the full reasoning.';
COMMENT ON COLUMN public.papic_guest_captures.tile_bytes IS
  'Byte size of the tile derivative (storage telemetry). NULL = unmeasured.';

-- ── GRANTS: the trap, checked rather than assumed ──────────────────────────
-- 🪤 A NEW COLUMN INHERITS NO COLUMN-LEVEL GRANTS. Where a table-level REVOKE
-- has pushed a privilege down to individual columns, a fresh column has that
-- privilege NOWHERE -- and naming it in a select then REJECTS THE WHOLE QUERY
-- (a rejected query is not a thrown error; the only symptom is an absence).
--
-- Measured before writing this (pg_attribute.attacl / pg_class.relacl -- NOT
-- information_schema, which is the wrong catalog for this question):
--
--   papic_photos          39 of 40 columns carry their own ACL,
--                         table ACL authenticated = rdDxtm  -> SELECT (r) IS
--                         table-level, so a new column IS readable. The
--                         per-column grants are UPDATE, which only the
--                         service-role writer needs.
--   papic_guest_captures  0 column ACLs, table ACL authenticated = arwdDxtm.
--   (events, for contrast, has NO table-level r: 188 of 202 columns granted
--    individually. That is where this trap actually bites.)
--
-- So no explicit grant is required here. The GRANT below is written anyway,
-- because it is idempotent, costs nothing, and makes the read survive a future
-- table-level REVOKE on papic_photos -- which is exactly what happened to
-- `events`. A test asserts an RLS client can really read the column; that
-- assertion, not this comment, is the mechanism.
GRANT SELECT (tile_r2_key, tile_bytes) ON public.papic_photos TO authenticated, anon;
GRANT SELECT (tile_r2_key, tile_bytes) ON public.papic_guest_captures TO authenticated, anon;

-- ── WHAT THE EXPOSURE BASELINE WILL SHOW, AND WHY IT IS RIGHT ──────────────
-- Four new facts, reviewed rather than rubber-stamped:
--
--   papic_photos.tile_r2_key / tile_bytes            anon=S   authenticated=S
--   papic_guest_captures.tile_r2_key / tile_bytes    anon=SIU authenticated=SIU
--
-- NARROWER than their own siblings on papic_photos, where display_r2_key /
-- thumb_r2_key / r2_object_key all read `authenticated=SIU` — they carry
-- explicit per-column UPDATE grants and these deliberately do not. NO RLS
-- CLIENT EVER WRITES A DERIVATIVE REF: the pipeline runs under the service
-- role. Granting only SELECT is picking the tool by what the legitimate code
-- must name.
--
-- The SIU on papic_guest_captures is inherited from that table's table-level
-- grant and CANNOT be narrowed per column (a column-level REVOKE cannot cut
-- below a table-level grant; only a table-level REVOKE would, which would move
-- all 30 columns and is a different change). It is not reachable: the only
-- write policy on that table is `papic_guest_captures_admin_all` — `is_admin()`
-- for USING and WITH CHECK, `authenticated` only — so a guest cannot UPDATE the
-- row at all and anon has no write policy whatsoever. Verified against prod
-- (pg_policy) before writing this, not assumed. The grant is part of the known
-- dead-anon-grant debt; this migration neither widens nor inherits new reach.
--
-- 🔑 Why it would matter if it WERE reachable: `tile_r2_key` is presigned and
-- served, so a forged value would read an arbitrary object out of our R2
-- buckets. That is the "the row is yours, the field is not" shape, and it is
-- the reason this was checked instead of pattern-matched to the siblings.
