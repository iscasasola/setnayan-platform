-- Remove the free Papic sampler (the 3-seat free trial · was owner-locked
-- 2026-06-16). Superseded by the per-camera "first 5 guest cameras free" funnel
-- (owner 2026-06-27): an event should have ONE free Papic model, the 5 free
-- cameras. The sampler feature is fully torn out in app code (provisioning,
-- per-seat caps, 30-day retention, convert-to-permanent relocation, expiry
-- emails, the /admin/papic-sampler surface, the R2 lifecycle script); this
-- migration reverses its DB surface.
--
-- DATA-PRESERVING (no couple loses a photo): the handful of existing sampler
-- captures are KEPT. Their 30-day expiry is cleared so they become permanent —
-- consistent with the "free = the kept memory for life" decision (DECISION_LOG
-- 2026-06-23). The existing sampler seats simply become ordinary claimed seats
-- once the flag column is dropped; their photos stay in the couple gallery.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied): IF EXISTS / IF NOT
-- guards throughout.

begin;

-- 1. Make any still-expiring captures permanent. After the sampler is gone, no
--    capture path sets papic_photos.expires_at, so this also future-proofs the
--    column to "always null".
update public.papic_photos
  set expires_at = null
  where expires_at is not null;

-- 2. Drop the sampler RPCs — provisioning + the record-/presign-layer caps.
drop function if exists public.papic_provision_sampler(uuid);
drop function if exists public.papic_sampler_remaining(uuid, text);
drop function if exists public.papic_sampler_insert_capture(uuid, text, text, text, timestamptz);

-- 3. Drop the sampler expiry-email log (its RLS policies drop with it).
drop table if exists public.papic_sampler_email_log;

-- 4. Drop the sampler flag. No index / RLS policy / view / check constraint
--    depends on it (verified before authoring). The existing sampler seats
--    become ordinary claimed seats — their captures are untouched.
alter table public.paparazzi_seats drop column if exists is_free_sampler;

-- NOTE: public.papic_photos.expires_at is intentionally KEPT (now vestigial /
-- always null). The couple-gallery + Library read filters still reference it
-- harmlessly (a permanent no-op); dropping it would touch the permanent-gallery
-- read paths for zero benefit.

commit;
