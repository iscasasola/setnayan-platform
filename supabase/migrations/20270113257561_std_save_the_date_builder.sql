-- Save-the-Date builder columns (iteration 0024 · PR4 P4).
--
-- The couple's two persisted Save-the-Date choices:
--   std_reveal_template        — which of the 5 opening reveals plays over their
--                                page (four-flap · two-flap-vertical ·
--                                two-flap-horizontal · church-doors · veil-sheer).
--                                Until now the chooser only PREVIEWED; the live
--                                page fell back to the admin house default. NULL
--                                still means "use the house default".
--   std_invitation_launch_date — when the full invitation goes live; drives the
--                                film's "invitation to follow" beat + the second
--                                VEVENT in the end-of-film add-to-calendar (P3).
--                                A DATE (no time) — same shape as event_date.
--
-- The film's music + closing gallery are NOT new columns: they reuse the
-- couple's existing site music (events.site_bg_music_*) + curated photos
-- (events.our_photos), resolved in lib/save-the-date-content.ts (P2). A
-- dedicated Pakanta-song / STD-video override is deferred (owner decision —
-- see the build plan + DECISION_LOG).
--
-- No RLS change: events already carries couple_can_update_event (couples write
-- their own row) + the current_event_ids() SELECT policy (migration
-- 20260512000000). Additive + idempotent.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_reveal_template TEXT,
  ADD COLUMN IF NOT EXISTS std_invitation_launch_date DATE;

COMMENT ON COLUMN public.events.std_reveal_template IS
  'Save-the-Date opening reveal the couple chose (reveal-config REVEAL_TEMPLATE_IDS); NULL = admin house default. Iteration 0024 PR4.';
COMMENT ON COLUMN public.events.std_invitation_launch_date IS
  'Date the full invitation goes live; drives the STD film "invitation to follow" beat + the second add-to-calendar VEVENT. Iteration 0024 PR4.';
