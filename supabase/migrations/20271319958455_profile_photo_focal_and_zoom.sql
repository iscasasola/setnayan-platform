-- profile_photo_focal_and_zoom
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🖼 A PERSON'S PROFILE PICTURE KEEPS ITS ALIGN AND ZOOM — the SAME frame the shop logo got in
-- 20271316444107_shop_logo_focal_and_zoom. ⚖ Owner, 2026-11-06, asked whether the profile picture gets the
-- logo's align + zoom: "yes, use the same control". DECISION_LOG 2026-11-06 "THE PROFILE PICTURE WEARS THE
-- LOGO'S FRAME".
--
-- TWO columns, beside `profile_photo_url`, so moving the frame never needs a re-upload. Same types and the SAME
-- closed sets as the logo pair (`lib/picture-frame.ts` · `HUB_FOCAL_POINTS` / `HUB_ZOOMS`, `lib/hub-canvas.ts`):
--   profile_photo_focal — 1–9, a phone keypad (1 top-left · 5 centre · 9 bottom-right). NULL = 5.
--   profile_photo_zoom  — 100 · 120 · 150. NULL = 100 (as uploaded).
-- A value outside them is refused at the boundary rather than drawn as a guess.
--
-- Written only by the person themself, through the two forms that already write `profile_photo_url`
-- (`/dashboard/profile` and the signup "You" card — both via `planPersonalInfoPatch`), on their own client
-- under the existing `user_owns_row` policy.
--
-- 🔒 GRANTS — WHY THERE IS NO GRANT STATEMENT HERE (and why it is not the logo's column-grant block):
-- `vendor_profiles` carries COLUMN-scoped grants, so the logo pair had to be granted to `authenticated` by
-- name. `public.users` carries TABLE-level grants (anon S, authenticated SU — see the exposure baseline), and a
-- column inherits them; a column-level REVOKE cannot subtract from a table-level grant in Postgres, so a
-- "REVOKE … FROM anon" here would be a no-op that reads like a protection. The precedent for a `users` column
-- is 20271236036451_share_profile_photo_with_hosts (no GRANT, same reason). Rows stay RLS-scoped: `users` has no
-- policy for `anon`, so anon reaches no row, and `authenticated` reaches only its own (`user_owns_row`) or,
-- for an admin, `admin_full_access_users`. Two small integers about how a picture is cropped carry no PII.
--
-- `guard_users_privilege_columns` pins only is_internal / is_team_member / account_type, so these pass through.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_photo_focal SMALLINT,
  ADD COLUMN IF NOT EXISTS profile_photo_zoom SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_photo_focal_chk') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_profile_photo_focal_chk
      CHECK (profile_photo_focal IS NULL OR profile_photo_focal BETWEEN 1 AND 9);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_photo_zoom_chk') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_profile_photo_zoom_chk
      CHECK (profile_photo_zoom IS NULL OR profile_photo_zoom IN (100, 120, 150));
  END IF;
END $$;

COMMENT ON COLUMN public.users.profile_photo_focal IS
  'Owner 2026-11-06 ("yes, use the same control"): which of the profile picture''s 9 areas stays in frame — 1 top-left, 5 centre, 9 bottom-right (HUB_FOCAL_POINTS, lib/hub-canvas.ts). NULL = centre. The same frame as vendor_profiles.logo_focal; rendered through pictureFrameStyle (lib/picture-frame.ts).';
COMMENT ON COLUMN public.users.profile_photo_zoom IS
  'Owner 2026-11-06 ("yes, use the same control"): how far into the frame the profile picture is pushed — 100 as uploaded, 120, 150 (HUB_ZOOMS). NULL = 100. The same frame as vendor_profiles.logo_zoom.';
