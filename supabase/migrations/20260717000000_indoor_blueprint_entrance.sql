-- Indoor Blueprint — venue entrance marker
--
-- Closes the partial INDOOR_BLUEPRINT SKU (₱1,499 · "Your whole venue, mapped
-- and seated" · v2.1 brief § 5 + Onboarding Blueprint §3.3). The seating-chart
-- editor (iteration 0008) already places tables on a floor plan; the missing
-- "entrance → table" wayfinding (v2-catalog.ts: "entrance-to-table nav not
-- built") needs to know where the venue entrance is so the guest-facing
-- "find your table" view can draw a path from the door to the guest's table.
--
-- These two columns store the entrance position as 0–100 percentages on the
-- same canonical floor-plan coordinate grid the seating editor uses (x_pos /
-- y_pos on event_tables). NULL = "not placed yet" — the app falls back to the
-- conventional bottom-center default (lib/indoor-blueprint.ts DEFAULT_ENTRANCE)
-- so wayfinding works the instant the couple owns the SKU, even before they
-- fine-tune the marker.
--
-- Additive + nullable + idempotent — safe to apply to a live database with no
-- backfill and no behavior change for any existing surface. The columns are
-- read ONLY behind the Indoor Blueprint ownership gate (the couple's add-on
-- page + the guest find-my-table route); the public landing page never reads
-- them. RLS on `events` is unchanged — these columns inherit the existing
-- per-event policies.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_entrance_x NUMERIC,
  ADD COLUMN IF NOT EXISTS venue_entrance_y NUMERIC;

COMMENT ON COLUMN public.events.venue_entrance_x IS
  'Indoor Blueprint: venue entrance X as a 0–100 percentage on the seating floor-plan grid. NULL = use bottom-center default.';
COMMENT ON COLUMN public.events.venue_entrance_y IS
  'Indoor Blueprint: venue entrance Y as a 0–100 percentage on the seating floor-plan grid. NULL = use bottom-center default.';
