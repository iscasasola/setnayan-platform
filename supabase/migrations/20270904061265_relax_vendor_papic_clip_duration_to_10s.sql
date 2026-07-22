-- relax vendor papic clip duration to 10s
--
-- Owner override 2026-07-22 (Papic_One_Pool_Model_Spec §0): a Papic clip moves
-- from a 5-second to a 10-second cap. The couple/guest half of this PR raised
-- every guest + seat enforcement layer to 10000ms; the vendor ON-THE-DAY lane
-- was only HALF-migrated — the client + point weight moved, but two server-side
-- 5s caps were left behind:
--   1. app/api/vendor/papic-capture/route.ts MAX_CLIP_MS (raised to 10000 in
--      this PR — the route rejected a >5s clip with 400 too_long), and
--   2. THIS constraint: vendor_papic_captures.clip_duration_ms CHECK … <= 5000,
--      defined inline in 20270811377742_vendor_papic_capture_counsel_gated.sql
--      (an applied/committed migration we must NOT edit in place).
-- With both left at 5s, a genuine 6–10s vendor clip that spends 7 points would
-- be rejected at the route or violate this CHECK on insert. Relax the ceiling to
-- 10000ms so the vendor lane agrees with the guest lane.
--
-- The inline column CHECK is auto-named vendor_papic_captures_clip_duration_ms_check
-- (verified against the replayed prod schema). Idempotent: DROP IF EXISTS then
-- re-ADD, guarded with ALTER TABLE IF EXISTS because the source table lives in a
-- COUNSEL-GATED migration (do-not-push-until-DPO-ruling) — if that table has not
-- been provisioned in a given environment this migration is a clean no-op. No
-- rename, no is_active/status flip, no data change (nothing exceeds 5000 today).

BEGIN;

ALTER TABLE IF EXISTS public.vendor_papic_captures
  DROP CONSTRAINT IF EXISTS vendor_papic_captures_clip_duration_ms_check;

ALTER TABLE IF EXISTS public.vendor_papic_captures
  ADD CONSTRAINT vendor_papic_captures_clip_duration_ms_check CHECK (
    clip_duration_ms IS NULL
    OR (clip_duration_ms > 0 AND clip_duration_ms <= 10000)
  );

COMMIT;
