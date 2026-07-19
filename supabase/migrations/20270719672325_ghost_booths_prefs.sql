-- 3D Booth Ads · Part A (slice 9, owner-locked 2026-07-08) — ghost-booth prefs.
-- The couple's per-event controls for the dashed "ghost booths" (unbooked vendor
-- categories) shown ONLY in their own 3D planning lab:
--   · ghost_booths_enabled    — the master toggle (ON by default, per the lock).
--   · ghost_booths_dismissed  — VendorCategory keys the couple dismissed the
--                               ghost booth for (per-booth "×").
-- Lives on event_floor_plan (the couple's per-event display-prefs home, 1:1 with
-- the event). Ghost booths themselves are DERIVED at read time (no rows) — only
-- these prefs persist. RLS on event_floor_plan already scopes rows to the event;
-- no policy change needed. Idempotent.

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS ghost_booths_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS ghost_booths_dismissed TEXT[] NOT NULL DEFAULT '{}'::text[];

