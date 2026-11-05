-- 🌗 LIGHT IS THE DEFAULT AGAIN — until dark mode covers every screen (owner 2026-10-23).
--
-- Owner, verbatim: "if there are too many, make light the default first" · "but if the build is small
-- to fix it, then make automatic default". Measured 23 Oct: about 10 of ~320 user-facing pages are
-- DARK_READY and ~16 area PRs remain, so it is "too many" → Light.
--
-- Reverses ONLY what 20271285255801 (Automatic by default) moved: it turned every Light last touched
-- before 2026-10-23 02:06:57Z into Automatic, without touching updated_at. Measured in prod before this
-- file: 22 rows are 'auto', every one last updated on or before 2026-10-21 — none was picked by a person
-- (Automatic did not exist as a choice before that migration). A Light or Dark someone picked after the
-- cutoff is untouched, and so is an Automatic picked after it (its updated_at is later).
-- Idempotent: re-running finds nothing to change.

UPDATE public.users
   SET theme_preference = 'light'
 WHERE theme_preference = 'auto'
   AND updated_at < TIMESTAMPTZ '2026-10-23 02:06:57+00';

ALTER TABLE public.users
  ALTER COLUMN theme_preference SET DEFAULT 'light';
