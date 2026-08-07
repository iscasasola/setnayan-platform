-- The host decides when guests may start shooting.
--
-- Owner, 2026-08-07: "The guests can have the option to use the app on the exact
-- event or when the host allows it." And: "this means there should be a button
-- for the host of the event to allow guests to use the papic."
--
-- ── WHAT WAS ACTUALLY THERE ─────────────────────────────────────────────────
-- Guests had NO time gate of any kind. `eventPapicGuestActive()` asks one
-- question — does this event hold the guest-camera pass, paid or via the free
-- pool — and nothing anywhere asked WHEN. A guest who redeemed their invite six
-- months out could open the camera and shoot into the couple's gallery on any
-- random Tuesday, and the couple had no way to stop it.
--
-- That is the exact mirror of the seat-camera defect fixed the same day: seat
-- cameras were locked to a SINGLE DAY and refused everything, while guest
-- cameras were open permanently. Both wrong, in opposite directions.
--
-- ── THE MODEL ───────────────────────────────────────────────────────────────
-- FALSE (default) — guests may shoot on the EVENT DAY only, the whole Manila
--                   day, midnight to midnight.
-- TRUE            — guests may shoot for the event's whole Papic capture
--                   window, the same span the seat cameras use.
--
-- Deliberately a BOOLEAN and not a date. The owner asked for "a button", and the
-- permission is a judgement the host makes once ("the pre-nup is tomorrow, let
-- them in"), not a schedule they want to maintain. A date field would also be a
-- second, independent window to keep in sync with the seat window — two values
-- that look alike and mean different things, which is the failure mode this
-- project keeps paying for.
--
-- ── WHY THE HOST DOES NOT WRITE IT DIRECTLY ─────────────────────────────────
-- `events` UPDATE is column-privileged (migration 20271005100000) and this
-- column is deliberately NOT added to the `authenticated` allowlist: `events`
-- UPDATE RLS is row-level, so a writable column on that table is writable by
-- anyone who can update the row at all. The host sets it through a server action
-- that checks their membership first — the same shape as
-- `face_tagging_declined_by_couple` and the livestream audience switch.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_guest_capture_early boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.papic_guest_capture_early IS
  'The host has opened guest cameras BEFORE the event day. FALSE (default): '
  'guests may shoot on the event day only. TRUE: guests may shoot for the '
  'event''s whole Papic capture window, same as seat cameras. Written by '
  'setPapicGuestCaptureEarly (service-role, membership-checked) because events '
  'UPDATE is column-privileged and row-level. Added 2026-08-07: guests '
  'previously had NO time gate at all — the pass check asks only WHETHER, never '
  'WHEN — so a guest could shoot into the gallery months before the wedding.';

-- The write side must stay shut: this is the couple's setting, changed through a
-- membership-checked server action, never by a direct table UPDATE.
REVOKE UPDATE (papic_guest_capture_early) ON public.events FROM anon, authenticated;
