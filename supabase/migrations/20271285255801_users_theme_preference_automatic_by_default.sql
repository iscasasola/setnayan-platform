-- users.theme_preference: Automatic (follow the phone) is the DEFAULT — owner 2026-10-23.
--
-- Owner, verbatim: "yes add automatic, default after steps 3-4", then seconds later "set it to automatic".
-- Supersedes call 1 of 2026-10-13 ("no follow the phone"), which 20271267769389 implemented by moving
-- every 'auto' row to 'light' and making 'light' the default. The enum always kept 'auto'.
--
-- WHO MOVES. People who already PICKED Light or Dark keep it; everyone else follows the phone.
--   · 'dark'  — only ever written by a person's pick → kept.
--   · 'light' — written by 20271267769389 for everyone (nobody could pick: the Appearance row was hidden
--     until the first route joined the ready-list, live in production from 2026-10-23 02:06:57 UTC, #6811).
--     `updateThemePreference` stamps `updated_at` with every pick, so a 'light' row last touched BEFORE the
--     row appeared cannot be a pick → 'auto'. A 'light' row touched since then is KEPT — that may keep a few
--     people who edited something else in that hour on Light, the safe side (they see what they see today
--     and can pick Automatic themselves).
--
-- Nothing paints dark outside the ready-list (lib/appearance.ts DARK_READY) and signed-out is always Light,
-- whatever this column says. Idempotent: a re-run finds no old 'light' rows and sets the same default.

UPDATE public.users
   SET theme_preference = 'auto'
 WHERE theme_preference = 'light'
   AND updated_at < TIMESTAMPTZ '2026-10-23 02:06:57+00';

ALTER TABLE public.users
  ALTER COLUMN theme_preference SET DEFAULT 'auto';
