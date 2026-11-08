-- profile_photo_focal_and_zoom
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🖼 A PERSON'S PROFILE PICTURE KEEPS ITS FRAME — the SAME frame the shop logo got in
-- 20271316444107_shop_logo_focal_and_zoom. ⚖ Owner, 2026-11-06, asked whether the profile picture gets the
-- logo's frame: "yes, use the same control". Owner 7 Nov (prototype v21, the logo step): "drag and pinch to
-- zoom". DECISION_LOG 2026-11-06 "THE PROFILE PICTURE WEARS THE LOGO'S FRAME" (rewritten 7 Nov for drag/pinch).
--
-- ⚠ RESHAPED BEFORE IT SHIPPED (7 Nov, A4). The first cut stored the Maker's keypad — `profile_photo_focal`
-- 1–9 + `profile_photo_zoom` 100 · 120 · 150. That control was replaced by drag + pinch before this migration
-- reached `main`, so it was edited in place rather than followed by a second one. It was never applied anywhere.
--
-- THREE columns, beside `profile_photo_url`, so moving the frame never needs a re-upload. The SAME ranges as the
-- logo's three (`lib/picture-frame.ts` · `PICTURE_FRAME_FIELDS`):
--   profile_focal_x — 0–100, object-position x %. NULL = 50 (centred).
--   profile_focal_y — 0–100, object-position y %. NULL = 50.
--   profile_zoom    — 100–300, the scale in %. NULL = 100 (the picture just covers the circle).
-- With object-fit: cover, every value in these ranges keeps the circle full — no empty edge can be stored.
-- A value outside them is refused at the boundary rather than drawn as a guess.
--
-- Written only by the person themself, through the two forms that already write `profile_photo_url`
-- (`/dashboard/profile` and the signup "You" card — both via `planPersonalInfoPatch`), on their own client
-- under the existing `user_owns_row` policy.
--
-- 🔒 GRANTS — WHY THERE IS NO GRANT STATEMENT HERE (and why it is not the logo's column-grant block):
-- `vendor_profiles` carries COLUMN-scoped grants, so the logo's columns had to be granted to `authenticated` by
-- name. `public.users` carries TABLE-level grants (anon S, authenticated SU — see the exposure baseline), and a
-- column inherits them; a column-level REVOKE cannot subtract from a table-level grant in Postgres, so a
-- "REVOKE … FROM anon" here would be a no-op that reads like a protection. The precedent for a `users` column
-- is 20271236036451_share_profile_photo_with_hosts (no GRANT, same reason). Rows stay RLS-scoped: `users` has no
-- policy for `anon`, so anon reaches no row, and `authenticated` reaches only its own (`user_owns_row`) or,
-- for an admin, `admin_full_access_users`. Three small integers about how a picture is cropped carry no PII.
--
-- `guard_users_privilege_columns` pins only is_internal / is_team_member / account_type, so these pass through.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_focal_x SMALLINT,
  ADD COLUMN IF NOT EXISTS profile_focal_y SMALLINT,
  ADD COLUMN IF NOT EXISTS profile_zoom SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_focal_x_chk') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_profile_focal_x_chk
      CHECK (profile_focal_x IS NULL OR profile_focal_x BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_focal_y_chk') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_profile_focal_y_chk
      CHECK (profile_focal_y IS NULL OR profile_focal_y BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_zoom_chk') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_profile_zoom_chk
      CHECK (profile_zoom IS NULL OR profile_zoom BETWEEN 100 AND 300);
  END IF;
END $$;

COMMENT ON COLUMN public.users.profile_focal_x IS
  'Owner 2026-11-06 ("yes, use the same control") + 7 Nov ("drag and pinch to zoom"): the profile picture''s object-position x, 0–100 %. NULL = 50 (centred). The same frame as vendor_profiles.logo_focal_x; rendered through pictureFrameStyle (lib/picture-frame.ts).';
COMMENT ON COLUMN public.users.profile_focal_y IS
  'Owner 2026-11-06 + 7 Nov: the profile picture''s object-position y, 0–100 %. NULL = 50. The same frame as vendor_profiles.logo_focal_y.';
COMMENT ON COLUMN public.users.profile_zoom IS
  'Owner 2026-11-06 + 7 Nov: the profile picture''s zoom, 100–300 % (100 = just covers the circle). NULL = 100. The same frame as vendor_profiles.logo_zoom.';
