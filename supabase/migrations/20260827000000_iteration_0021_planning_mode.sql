-- Iteration 0021 · Planning mode (Guided ⇄ Manual)
--
-- Owner 2026-06-05: couples can switch the whole event into a self-driven
-- "Manual" mode that turns OFF Setnayan's automated layer — vendor-match
-- personalization (the "Matching you on" strip + "% match" pills + taste
-- sort), the per-service + statutory DEADLINES, and the auto-tasks
-- ("Today's Focus"). The app stays fully usable (every tool + a working,
-- compatibility-scoped vendor directory + messaging); it just stops tailoring
-- and nudging. Default 'guided' = today's behavior, so existing rows are
-- unchanged.
--
-- Owner explicitly accepted that Manual mode also hides the LEGAL/statutory
-- dates with no warning, knowingly reversing the locked "statutory dates show
-- to every couple" safety default (see DECISION_LOG 2026-06-05). The flag is
-- the single source of truth read by Home, the Services tab, and the deadline
-- layer.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS planning_mode TEXT NOT NULL DEFAULT 'guided'
    CHECK (planning_mode IN ('guided', 'manual'));

COMMENT ON COLUMN public.events.planning_mode IS
  'Guided (default) = Setnayan personalization + deadlines + auto-tasks ON. '
  'Manual = self-driven: those automated layers OFF, app + vendor directory '
  'stay usable. Owner 2026-06-05 (iteration 0021).';
