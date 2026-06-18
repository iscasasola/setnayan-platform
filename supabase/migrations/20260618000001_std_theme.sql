-- Save-the-Date theme column (iteration 0024 · PR4 P4 — live builder).
--
-- Stores the couple's chosen film theme (visual style applied to the content
-- film: Mood Board · Editorial · Heritage · Noir · Botanical). Separate from the
-- opening reveal (std_reveal_template) — the reveal is the cinematic entrance;
-- the theme is the background/font/colour style of the film itself.
--
-- NULL → default 'moodboard' (couple's mood board palette + display font).
-- Values validated client-side against STD_THEME_IDS in lib/std-themes.ts.
--
-- Additive + idempotent; existing RLS (couple_can_update_event) covers it.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_theme TEXT;

COMMENT ON COLUMN public.events.std_theme IS
  'Save-the-Date film visual theme chosen by the couple (STD_THEME_IDS in lib/std-themes.ts). NULL = moodboard (default). Iteration 0024 PR4.';
