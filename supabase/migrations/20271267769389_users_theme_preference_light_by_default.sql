-- users.theme_preference: Light by default; nobody is on "follow the phone" (dark mode PR 3)
--
-- Owner, 2026-10-13 — "approve all" on the dark-mode map (DECISION_LOG "HOW DARK MODE IS TURNED ON"),
-- call 1: there is NO "Automatic / follow the phone" option. Appearance is Light · Dark, chosen by the
-- person; Light is the default; dark is something a person picks.
--
-- WHY A MIGRATION. Every account was created on the column default 'auto' (set by
-- 20260606000000_users_theme_preference_three_mode.sql) — measured in prod 2026-10-13: 20 of 20 rows
-- are 'auto', none is 'light' or 'dark'. While the app was light-locked nothing read the column, so
-- 'auto' meant nothing. With the switch back, 'auto' would be a third value no control can show.
-- So every 'auto' becomes 'light' (what all of them see today), and new accounts start on 'light'.
--
-- The enum keeps its 'auto' value: dropping an enum value means rebuilding the type and the column
-- (the 2026-06-06 dance), which is churn for nothing — the app no longer writes it, and
-- `updateThemePreference` refuses it. If "Automatic" is ever wanted, it is already a valid value.
--
-- Idempotent: re-running finds no 'auto' rows and sets the same default.

UPDATE public.users
   SET theme_preference = 'light'
 WHERE theme_preference = 'auto';

ALTER TABLE public.users
  ALTER COLUMN theme_preference SET DEFAULT 'light';
