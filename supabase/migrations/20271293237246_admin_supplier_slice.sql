-- admin_supplier_slice
-- ============================================================================
-- ADMIN SUPPLIER SLICE (owner 2026-10-28: "A"; DECISION_LOG "ADMIN SUPPLIER
-- SLICE APPROVED — BUILD NOW"; prototype prototypes/admin_supplier_slice_2026-10-28/).
--
-- TWO ADDITIVE PARTS. Everything else the slice does rides tables that already
-- ship (vendor_verification_applications · vendor_correction_requests +
-- slug_change_log · vendor_image_flags · event_type_requests · help_messages).
--
--  1. vendor_correction_requests.decline_reason — "Decline with a reason". The
--     request table has the supplier's own `note` (their why) but nowhere for
--     OURS, so a declined rename reached the shop as a bare "declined". The
--     reason is picked from a fixed list in Admin › Work
--     (lib/admin/supplier-work.ts SUPPLIER_WORK_REASONS.name) and the shop reads
--     it on its own request row (RLS: the owner already reads their rows).
--
--  2. Hub tools — Admin › Categories › Hub tools (DECISION_LOG 2026-10-28 "HUB TOOLS BY SERVICE — THE FULL
--     LIST IS THE SEED; ONE SHARED LIBRARY, NEVER PER-SERVICE COPIES" + "SUPPLIER SCAN = ALL FIVE MODES" 2026-10-03).
--     🔑 A TOOL IS A RECORD, NOT A NAME IN CODE. The owner approved (2026-10-28, prototypes/hub_tools_working_ +
--     admin_tool_maker_2026-10-28) that every tool is one of EIGHT shared templates and that a later Tool maker lets
--     admin define new tools. So:
--       · hub_tools                    — the ONE library: key · name · template · is_active. Seeded with the 43
--                                        approved tools (lib/hub-tools.ts). "Turn off" = is_active false: the tool
--                                        leaves every Hub but its switches (and later its data) are KEPT.
--       · category_hub_tool_switches   — which tool is SUGGESTED for which category (one row per pair, FK to both).
--                                        🔑 A SUGGESTION, NEVER A GATE (owner 2026-10-28: "These forms and tools are
--                                        all available to all services"): every supplier may use ANY active tool.
--       · category_hub_settings        — per category: the default scan mode. Its row existing = "an admin saved
--                                        this category"; no row = the approved seed (lib/hub-tools.ts hubToolsFor).
--     NOT built here (owner: later): the Tool maker and the templates' screens; per-tool fields / roles.
--     RLS: anyone signed in may READ all three (the supplier Hub reads them); only an admin writes (is_admin()).
--
-- KEEP THIS MIGRATION IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · Decline with a reason ──────────────────────────────────────────────
ALTER TABLE public.vendor_correction_requests
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

ALTER TABLE public.vendor_correction_requests
  DROP CONSTRAINT IF EXISTS vendor_correction_requests_decline_reason_len;
ALTER TABLE public.vendor_correction_requests
  ADD CONSTRAINT vendor_correction_requests_decline_reason_len
  CHECK (decline_reason IS NULL OR char_length(decline_reason) BETWEEN 1 AND 300);

COMMENT ON COLUMN public.vendor_correction_requests.decline_reason IS
  'Admin › Work "Decline" — the reason the shop reads, picked from a fixed list (lib/admin/supplier-work.ts). NULL when applied, open, or declined before 2026-10-28.';

-- ── 2 · Hub tools: the library, the switches, the scan default ─────────────
CREATE TABLE IF NOT EXISTS public.hub_tools (
  tool_key    TEXT PRIMARY KEY CHECK (tool_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label       TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  -- The eight shared templates (lib/hub-tools.ts HUB_TOOL_TEMPLATES).
  template    TEXT NOT NULL CHECK (template IN
                ('checklist', 'per_person', 'live_timeline', 'counter', 'ordered_list', 'plan', 'media', 'log')),
  -- Turn off keeps data: an inactive tool leaves every Hub; its rows stay.
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);
ALTER TABLE public.hub_tools ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.category_hub_tool_switches (
  category_id  TEXT NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  -- RESTRICT: a tool is turned off, never deleted out from under its switches.
  tool_key     TEXT NOT NULL REFERENCES public.hub_tools(tool_key) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, tool_key)
);
CREATE INDEX IF NOT EXISTS category_hub_tool_switches_tool_idx ON public.category_hub_tool_switches (tool_key);
ALTER TABLE public.category_hub_tool_switches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.category_hub_settings (
  category_id   TEXT PRIMARY KEY REFERENCES public.service_categories(id) ON DELETE CASCADE,
  -- The five scan modes. The supplier can change it per event; this is only the default a new booking starts with.
  scan_default  TEXT NOT NULL DEFAULT 'once'
                  CHECK (scan_default IN ('once', 'ordered_received', 'unlimited', 'group_session', 'roaming')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);
ALTER TABLE public.category_hub_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hub_tools', 'category_hub_tool_switches', 'category_hub_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()))', t || '_admin_write', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- The approved starting library (prototypes/hub_tools_by_service_2026-10-28 — 43 tools). Re-runs add nothing.
INSERT INTO public.hub_tools (tool_key, label, template, sort_order) VALUES
  ('fittings_and_measurements', 'Fittings & measurements', 'per_person', 10),
  ('delivery_and_drop_off', 'Delivery & drop-off', 'checklist', 20),
  ('entourage', 'Entourage', 'per_person', 30),
  ('looks_per_person', 'Looks per person', 'per_person', 40),
  ('chair_schedule', 'Chair schedule', 'ordered_list', 50),
  ('photo_upload', 'Photo upload (Photo by · credits)', 'media', 60),
  ('personalisation_list', 'Personalisation list', 'per_person', 70),
  ('wellness_plan', 'Wellness plan', 'plan', 80),
  ('queue_counter', 'Queue counter', 'counter', 90),
  ('papic_camera', 'Papic camera', 'media', 100),
  ('quantity_vs_guests', 'Quantity vs guests', 'counter', 110),
  ('dietary_and_allergies', 'Dietary & allergies', 'per_person', 120),
  ('load_in_and_venue_access', 'Load-in & venue access', 'checklist', 130),
  ('pick_up_times_and_routes', 'Pick-up times & routes', 'live_timeline', 140),
  ('headcount', 'Headcount', 'counter', 150),
  ('itinerary', 'Itinerary', 'live_timeline', 160),
  ('tables_and_seating', 'Tables & seating', 'plan', 170),
  ('serving_times', 'Serving times', 'live_timeline', 180),
  ('crew_roster', 'Crew roster', 'per_person', 190),
  ('floor_command', 'Floor Command', 'live_timeline', 200),
  ('run_of_show', 'Run of show (live)', 'live_timeline', 210),
  ('march', 'March (read)', 'live_timeline', 220),
  ('paperwork_checklist', 'Paperwork checklist', 'checklist', 230),
  ('reservation_slots', 'Reservation slots', 'ordered_list', 240),
  ('remembrance_schedule', 'Remembrance schedule', 'live_timeline', 250),
  ('emcee_script', 'Emcee script', 'live_timeline', 260),
  ('march_cue_sheet', 'March cue sheet (live)', 'live_timeline', 270),
  ('song_desk', 'Song Desk', 'ordered_list', 280),
  ('set_list', 'Set list', 'ordered_list', 290),
  ('tech_rider', 'Tech rider', 'checklist', 300),
  ('ceremony_details', 'Ceremony details', 'checklist', 310),
  ('live_studio', 'Live Studio', 'media', 320),
  ('rehearsal_and_cues', 'Rehearsal & cues', 'live_timeline', 330),
  ('insured_people_list', 'Insured people list', 'per_person', 340),
  ('proofs_and_approval', 'Proofs & approval', 'checklist', 350),
  ('incident_log', 'Incident log', 'log', 360),
  ('brackets_and_scoring', 'Brackets & scoring', 'ordered_list', 370),
  ('shot_list', 'Shot list', 'checklist', 380),
  ('photo_delivery', 'Photo delivery', 'media', 390),
  ('reveal_cue', 'Reveal cue', 'live_timeline', 400),
  ('floor_plan', 'Floor plan', 'plan', 410),
  ('safety_permit_and_cue', 'Safety permit & cue', 'checklist', 420),
  ('room_list', 'Room list', 'per_person', 430)
ON CONFLICT (tool_key) DO NOTHING;

COMMENT ON TABLE public.hub_tools IS
  'Admin › Categories › Hub tools (owner 2026-10-28): the ONE shared library — every tool a record with one of eight templates. Turn off (is_active=false) keeps data. A later Tool maker writes rows here.';
COMMENT ON TABLE public.category_hub_tool_switches IS
  'Which hub_tools record is SUGGESTED for which category ("Popular for florists") — never a gate: every supplier may use any active tool (owner 2026-10-28).';
COMMENT ON TABLE public.category_hub_settings IS
  'Per category: the default scan mode; the row existing means an admin saved the category (no row = the approved seed in lib/hub-tools.ts).';

COMMIT;
