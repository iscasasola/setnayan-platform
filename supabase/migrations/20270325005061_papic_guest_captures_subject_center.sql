-- papic guest captures subject center
-- ============================================================================
-- Tier-2 auto-reframe PRODUCER (Papic_Walkup_Face_Identity_Plan_2026-06-29 §10
-- "1.5a" + the Vids AI camera-move audit). Persists the NORMALIZED (0..1) center
-- of the dominant detected face on each guest capture, so the Stories render can
-- frame its pan/zoom/orbit on the subject instead of the geometric center.
--
-- Source: the SAME on-device face-api pass that already computes match
-- descriptors in the capture client (lib/face-embed.ts embedFaces) — no extra
-- model run, no server detection. The client sends the dominant-face center
-- alongside its descriptors; the guest-capture route persists it here via an
-- UPDATE keyed on the capture_id it already holds (no RPC signature change).
--
-- CONSUMER (Vids AI lane, not yet wired): lib/guest-stories.ts maps
-- subject_center_x/y → the render's `source.subjectCenter` (a `Focus`{x,y});
-- reel-render.ts already reads `subjectCenter`. Until that read lands this is
-- forward-compatible dormant data — harmless, additive, populated and waiting
-- (same pattern as the dormant face-vector pipeline).
--
-- NULL = no face detected, or the face model isn't hosted yet
-- (NEXT_PUBLIC_FACE_MODEL_URL unset → embedFaces returns no center). The render
-- falls back to the centered default focal, so NULL never breaks a render.
--
-- SAFETY: purely additive (two nullable REAL columns), fully idempotent. No RPC,
-- table, or RLS change; no behavior change for any existing read.
-- ============================================================================

BEGIN;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS subject_center_x REAL,
  ADD COLUMN IF NOT EXISTS subject_center_y REAL;

COMMENT ON COLUMN public.papic_guest_captures.subject_center_x IS
  'Normalized 0..1 x of the dominant (largest) detected face center, from the on-device face-api pass at capture. Feeds Stories Tier-2 auto-reframe (render subjectCenter). NULL = no face / face model not hosted → render uses the centered default focal.';
COMMENT ON COLUMN public.papic_guest_captures.subject_center_y IS
  'Normalized 0..1 y of the dominant detected face center (see subject_center_x).';

COMMIT;
