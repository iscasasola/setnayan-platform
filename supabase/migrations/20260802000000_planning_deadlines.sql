-- Admin-managed planning deadlines (2026-06-03 · owner directive "ship this both").
--
-- One table for ALL recommended LOCK-BY deadlines — the date a couple should
-- aim to have something booked/done, counted back from the wedding date. This
-- is the COUPLE's lock-by deadline (admin-set), DISTINCT from the vendor's own
-- delivery "plan" (the Service Schedule, vendor-set).
--
-- Replaces the hardcoded `PLAN_GROUPS.monthsBefore` (lib/wedding-plan-groups.ts)
-- + `PAPERWORK_DEADLINES` (lib/upcoming-items.ts) as the source the Home
-- `recommended_deadline` reminders read. Until the read-path PR lands, the code
-- values stay as the fallback — this migration just creates + seeds the table.
--
-- GRANULARITY = inheritance-with-override (owner-approved):
--   • kind='service', scope='category' · ref_key = a plan-group id (26 seeded
--     here from monthsBefore) — the DEFAULT every leaf in that category inherits.
--   • kind='service', scope='leaf' · ref_key = a canonical_service leaf — an
--     admin OVERRIDE for one specific leaf (none seeded; added in /admin/taxonomy).
--   • kind='document' / 'milestone' · ref_key = the document/milestone key.
-- A leaf with no own-or-inherited row is what the future "missing deadline"
-- admin flag surfaces — so seeding the 26 category defaults means day one is
-- not a wall of flags.
--
-- offset_value + offset_unit keep months/weeks/days in one shape: services are
-- months (wedding − N months), documents are days (PH statutory windows).

CREATE TABLE IF NOT EXISTS public.planning_deadlines (
  deadline_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL CHECK (kind IN ('service', 'milestone', 'document')),
  ref_key      TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT 'category' CHECK (scope IN ('category', 'leaf')),
  label        TEXT,
  offset_value INTEGER NOT NULL CHECK (offset_value >= 0),
  offset_unit  TEXT NOT NULL DEFAULT 'month' CHECK (offset_unit IN ('day', 'week', 'month')),
  applies_to   TEXT,            -- optional ceremony_type filter (e.g. 'catholic'); NULL = all
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, ref_key, scope)
);

COMMENT ON TABLE public.planning_deadlines IS
  'Admin-managed recommended LOCK-BY deadlines (couple-side, counted back from wedding date). Seeds from PLAN_GROUPS.monthsBefore + PAPERWORK_DEADLINES; read by the Home recommended_deadline reminders. Distinct from the vendor delivery plan (Service Schedule).';

ALTER TABLE public.planning_deadlines ENABLE ROW LEVEL SECURITY;

-- Admin read/write everything (pattern: moodboard_library_assets · is_admin() from setnayan base).
DROP POLICY IF EXISTS planning_deadlines_admin_all ON public.planning_deadlines;
CREATE POLICY planning_deadlines_admin_all ON public.planning_deadlines
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Couples (any authenticated user) read deadlines — they're global config, not PII.
DROP POLICY IF EXISTS planning_deadlines_read ON public.planning_deadlines;
CREATE POLICY planning_deadlines_read ON public.planning_deadlines
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- ── Seed · service category defaults (from lib/wedding-plan-groups.ts PLAN_GROUPS.monthsBefore) ──
INSERT INTO public.planning_deadlines (kind, ref_key, scope, label, offset_value, offset_unit) VALUES
  ('service', 'ceremony_venue',         'category', 'Ceremony venue',           12, 'month'),
  ('service', 'reception_venue',        'category', 'Reception venue',          12, 'month'),
  ('service', 'coordinator',            'category', 'Wedding coordinator',      12, 'month'),
  ('service', 'officiant',              'category', 'Officiant',                 9, 'month'),
  ('service', 'catering',               'category', 'Catering',                  9, 'month'),
  ('service', 'photography',            'category', 'Photography & Video',       9, 'month'),
  ('service', 'attire',                 'category', 'Attire',                    8, 'month'),
  ('service', 'hair_makeup',            'category', 'Hair & Makeup',             6, 'month'),
  ('service', 'florals_decor',          'category', 'Florals & Decor',           6, 'month'),
  ('service', 'stylist',                'category', 'Stylist',                   6, 'month'),
  ('service', 'live_band',              'category', 'Live band',                 6, 'month'),
  ('service', 'music_entertainment',    'category', 'Band / DJ / Performer',     6, 'month'),
  ('service', 'dance_instructor',       'category', 'Dance instructor',          4, 'month'),
  ('service', 'after_party_music',      'category', 'After-party DJ',            1, 'month'),
  ('service', 'host_mc',                'category', 'Host / MC',                 5, 'month'),
  ('service', 'lights_sound',           'category', 'Lights & Sound',            5, 'month'),
  ('service', 'led_background',         'category', 'LED Background',            3, 'month'),
  ('service', 'cocktail_booths',        'category', 'Cocktail Booths',           4, 'month'),
  ('service', 'photobooth',             'category', 'Photobooth',                3, 'month'),
  ('service', 'cake',                   'category', 'Cake',                      4, 'month'),
  ('service', 'bridal_car',             'category', 'Bridal Car',                2, 'month'),
  ('service', 'guest_shuttle',          'category', 'Guest Shuttle',             2, 'month'),
  ('service', 'rings',                  'category', 'Rings',                     3, 'month'),
  ('service', 'accommodation',          'category', 'Accommodation',             2, 'month'),
  ('service', 'invitations_stationery', 'category', 'Invitations & Stationery',  4, 'month'),
  ('service', 'logistics',              'category', 'Logistics & Misc',          2, 'month')
ON CONFLICT (kind, ref_key, scope) DO NOTHING;

-- ── Seed · statutory document deadlines (from lib/upcoming-items.ts PAPERWORK_DEADLINES) ──
INSERT INTO public.planning_deadlines (kind, ref_key, scope, label, offset_value, offset_unit, applies_to) VALUES
  ('document', 'psa_cenomar_window',      'category', 'PSA + CENOMAR window',     180, 'day', NULL),
  ('document', 'marriage_license_window', 'category', 'Marriage license window',  120, 'day', NULL),
  ('document', 'pre_cana_cutoff',         'category', 'Pre-Cana cutoff',           60, 'day', 'catholic')
ON CONFLICT (kind, ref_key, scope) DO NOTHING;
