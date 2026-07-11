-- ============================================================================
-- RECOVERY RE-ADD (2026-07-11). Originally 20270713200100_appointment_type_catalog.sql
-- (commit a8a923f03) — applied to prod (28-row seed live) then the file was lost
-- from main. Re-added here under a proper allocator prefix. IDEMPOTENT (CREATE
-- TABLE IF NOT EXISTS · DROP POLICY IF EXISTS · per-row NOT EXISTS seed guard),
-- so re-applying against prod is a no-op; a fresh DB gets the 28 presets.
-- NOTE: the seed's `category` keys are ABSTRACT preset buckets (photo_video,
-- caterer, hmua, couturier, officiant, any, …), NOT the event_vendors.category
-- slugs — the app layer maps a vendor's real category slug onto these buckets.
-- ============================================================================

-- 20270713200100_appointment_type_catalog.sql
--
-- APPOINTMENT TYPE CATALOG — the category→meeting map reference table
-- (corpus: Relationship_Workspace_and_Appointments_2026-07-11.md
-- § "Category → meeting map"; PR 11). Seeds the preset appointment types the
-- scheduler offers per vendor service category (default mode + duration). It is
-- free-text `category`-keyed (NOT a strict enum) — vendors add their own custom
-- rows; the category strings here are the canonical presets, not a hard gate.
--
-- A 'custom' appointment type is ALWAYS available in the app to BOTH sides
-- regardless of this catalog, so no catalog row is needed for custom.
--
-- Reference data: any authenticated user may SELECT (it shapes the scheduler
-- they see); admin-only writes. RLS pattern MIRRORS wedding_season_factors
-- (20261001000000) — the canonical reference-table shape. Idempotent + re-run
-- safe.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_type_catalog (
  catalog_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category             text NOT NULL,     -- vendor service category (free-text keyed)
  type                 text NOT NULL,
  label                text NOT NULL,
  default_mode         text NOT NULL CHECK (default_mode IN ('in_person','video','voice')),
  default_duration_min int NOT NULL DEFAULT 60,
  sort_order           int NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS appointment_type_catalog_category_idx
  ON public.appointment_type_catalog (category, sort_order);

-- RLS AT CREATE TIME.
ALTER TABLE public.appointment_type_catalog ENABLE ROW LEVEL SECURITY;

-- Reference data — any authenticated user may read (it shapes their scheduler).
DROP POLICY IF EXISTS read_appointment_type_catalog ON public.appointment_type_catalog;
CREATE POLICY read_appointment_type_catalog ON public.appointment_type_catalog
  FOR SELECT TO authenticated
  USING (true);

-- Admin-only write (canonical is_admin() helper). Permissive policies are OR-ed,
-- so SELECT stays open to authenticated via the policy above; writes need is_admin().
DROP POLICY IF EXISTS admin_writes_appointment_type_catalog ON public.appointment_type_catalog;
CREATE POLICY admin_writes_appointment_type_catalog ON public.appointment_type_catalog
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.appointment_type_catalog IS
  'Category → meeting map (Relationship Workspace + Appointments, PR 11): preset appointment types per vendor service category with a default_mode + default_duration_min, seeded from the corpus map. Free-text category-keyed (not a strict enum); vendors add custom rows and a ''custom'' type is always available app-side regardless of this catalog. Reference data: authenticated SELECT (mirrors wedding_season_factors), admin-only write.';

-- ----------------------------------------------------------------------------
-- Seed — the category → meeting map. Re-run safe (NOT EXISTS guard per row so
-- an admin edit isn't clobbered on replay; keyed by (category, type)).
-- ----------------------------------------------------------------------------
INSERT INTO public.appointment_type_catalog
  (category, type, label, default_mode, default_duration_min, sort_order)
SELECT v.category, v.type, v.label, v.default_mode, v.default_duration_min, v.sort_order
FROM (VALUES
  -- Photo & Video
  ('photo_video', 'pre_shoot_call',    'Pre-shoot call',    'video',     30,  10),
  ('photo_video', 'engagement_shoot',  'Engagement shoot',  'in_person', 120, 20),
  ('photo_video', 'shot_list_review',  'Shot-list review',  'video',     45,  30),
  -- Caterer
  ('caterer', 'food_tasting',    'Food tasting',    'in_person', 90, 10),
  ('caterer', 'menu_consult',    'Menu consult',    'video',     45, 20),
  ('caterer', 'final_headcount', 'Final headcount', 'video',     30, 30),
  -- Venue
  ('venue', 'site_visit',       'Site visit',       'in_person', 60, 10),
  ('venue', 'final_walkthrough', 'Final walkthrough', 'in_person', 60, 20),
  -- Bridal couturier
  ('couturier', 'measurements',  'Measurements', 'in_person', 45, 10),
  ('couturier', 'fitting_1',     '1st fitting',  'in_person', 60, 20),
  ('couturier', 'fitting_2',     '2nd fitting',  'in_person', 60, 30),
  ('couturier', 'fitting_final', 'Final fitting', 'in_person', 60, 40),
  -- Hair & Makeup
  ('hmua', 'makeup_trial', 'Makeup trial', 'in_person', 90, 10),
  ('hmua', 'look_consult', 'Look consult', 'video',     30, 20),
  -- Cake & pastry
  ('cake', 'cake_tasting',  'Cake tasting',  'in_person', 60, 10),
  ('cake', 'design_consult', 'Design consult', 'video',   45, 20),
  -- Florist / Stylist
  ('florist', 'styling_consult', 'Styling consult', 'video',     45, 10),
  ('florist', 'mock_setup',      'Mock setup',      'in_person', 90, 20),
  -- Coordinator / Planner
  ('coordinator', 'kickoff',          'Kickoff',          'video',     45, 10),
  ('coordinator', 'monthly_checkin',  'Monthly check-in', 'video',     30, 20),
  ('coordinator', 'final_walkthrough', 'Final walkthrough', 'in_person', 60, 30),
  ('coordinator', 'rehearsal',        'Rehearsal',        'in_person', 120, 40),
  -- Band / DJ / Musician
  ('band_dj', 'songlist_consult', 'Song-list consult', 'video',     45, 10),
  ('band_dj', 'sound_check',      'Sound check',       'in_person', 60, 20),
  -- Officiant
  ('officiant', 'counseling', 'Counseling', 'video',     60, 10),
  ('officiant', 'rehearsal',  'Rehearsal',  'in_person', 90, 20),
  -- Any vendor
  ('any', 'consultation', 'Consultation', 'video', 30, 10),
  ('any', 'voice_call',   'Voice call',   'voice', 20, 20)
) AS v(category, type, label, default_mode, default_duration_min, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.appointment_type_catalog c
  WHERE c.category = v.category AND c.type = v.type
);

COMMIT;
