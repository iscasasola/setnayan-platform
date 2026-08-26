-- papic_uploads_open — "can photos be added by hand to this celebration?"
--
-- Owner 2026-08-26: *"a toggle will set if they will allow people to upload
-- photos manually as well"* and *"uploading can depend on the toggle for photo
-- upload."*
--
-- ⚖ IT DEFAULTS OPEN, AND THAT IS A CHOICE WORTH STATING. Papic's purpose is
-- now *"the source where they collect media files for that event"* (owner, same
-- day), so a library that refuses the most obvious way to put something in it
-- would be closed against its own point. An upload costs a credit exactly like
-- a shot, so an open door is not a free one. A couple who wants only what was
-- caught in the moment can shut it.
--
-- ⚠ ITS SIBLINGS DEFAULT DIFFERENTLY AND THAT IS NOT AN INCONSISTENCY.
-- `papic_guest_capture_early` defaults FALSE because it hands a capability to
-- OTHER PEOPLE, and a wedding must never quietly acquire one.
-- `papic_vendor_challenges_enabled` defaults TRUE for the same reason this one
-- does: it governs a thing the couple already owns.
--
-- ── WHAT IT GOVERNS TODAY, AND WHAT IT WILL ─────────────────────────────────
-- Today the only manual-upload path in the product is the couple's own "Add to
-- your library" picker, so this is the couple's switch over their own library.
-- When guests and suppliers get an upload path, they read the SAME column.
--
-- 🔑 AND THE SERVER MUST READ IT THEN, NOT JUST THE SCREEN. Hiding the picker
-- is enough while the only holder of the Uploads camera is the couple
-- themselves — a couple bypassing their own preference harms nobody. The moment
-- somebody ELSE can upload, a hidden control is not a closed door: this
-- codebase has paid for that distinction repeatedly (the live photo wall
-- mirrored to every guest's phone while the only "off" switch closed the venue
-- screens). **Gate the write, not the button.**

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_uploads_open BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.events.papic_uploads_open IS
  'Can photos and clips be added BY HAND to this celebration (as opposed to '
  'captured live)? Owner-set 2026-08-26. Defaults TRUE: Papic is the event''s '
  'media library and an upload already costs a credit, so an open door is not a '
  'free one. Today it governs the couple''s own picker; when guests or suppliers '
  'gain an upload path they read this same column — and the SERVER must check it '
  'then, not only the screen. Hiding a control is not closing a door.';

COMMIT;
