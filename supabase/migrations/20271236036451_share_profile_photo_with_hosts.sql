-- share_profile_photo_with_hosts
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ─────────────────────────────────────────────────────────────────────────────
-- SHOWING YOUR FACE TO A COUPLE IS A CHOICE — ⚖ owner 2026-09-20, on being told
-- that linking a guest row to an account would disclose that account's photo to
-- the event's couple: "keep it opt-in, add the preference column".
--
-- 🔑 NULLABLE, WITH NO DEFAULT, AND NULL MEANS OFF. Three reasons, in order:
--   1. Opt-in is the whole point. A `NOT NULL DEFAULT TRUE` would have shared
--      every existing account's photo the moment this merged — the disclosure
--      the owner just declined, performed once, silently, on everyone.
--   2. NULL is how this schema already spells "never answered": its sibling
--      `users.discoverable_by_name` is read as `?? true` for exactly that
--      reason (a row predating the column must mean the DEFAULT, not off).
--      This one reads `?? false`. Same shape, opposite default, because the
--      question is opposite.
--   3. A DEFAULT would be a decision nobody made, recorded as though they had.
--      "Has not been asked" and "said no" are the same behaviour here but they
--      are not the same fact, and the day we add a prompt the difference is
--      what tells us who to ask.
--
-- No GRANT: `public.users` carries TABLE-level grants, so the column inherits
-- them, and the existing self-update policy is what already lets somebody set
-- `discoverable_by_name` from the same form.
--
-- `guard_users_privilege_columns` pins only is_internal / is_team_member /
-- account_type, so a preference column passes through it untouched (checked
-- against the live function body, 2026-09-20).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS share_profile_photo_with_hosts boolean;

COMMENT ON COLUMN public.users.share_profile_photo_with_hosts IS
  'OPT-IN. When TRUE, the couple running an event this person has joined may see their profile photo on the guest list where no guest photo was uploaded (lib/guest-account-photos.ts). NULL = never answered = OFF; there is deliberately no DEFAULT, so "not asked" stays distinguishable from "said no". Never flip this to true in a migration — that performs the disclosure the owner declined on 2026-09-20.';
