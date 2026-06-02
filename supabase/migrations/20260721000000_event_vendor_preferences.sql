-- ============================================================================
-- event_vendor_preferences — couple-side per-category match preferences
-- ============================================================================
-- CLAUDE.md 2026-06-02 "do both" · step 2 FOUNDATION.
--
-- The couple-side mirror of iteration 0044's vendor_service_attributes. A
-- vendor of a canonical_service fills attribute_payload (cuisine_specialties,
-- dietary_accommodations, etc.); this table lets the COUPLE express the same
-- shape of preference per canonical_service. The match layer (Layer-B SORT,
-- per Vendor_Match_Personalization_2026-06-01.md) floats vendors whose
-- vendor_service_attributes.attribute_payload @> the couple's preference up —
-- "matches your preference" — never excludes.
--
-- WHY this is shipped as foundation-only (no capture UI / no match-read yet):
-- vendor_service_attributes is EMPTY in production (no vendor is tagged with
-- facet values yet — that needs the vendor-side 0044 attribute-fill UI +
-- vendor input / admin seeding). Until vendors carry facet payloads, any
-- preference match is a no-op. This migration lands the canonical storage so
-- (a) onboarding Phase 5 / a couple pref editor can persist prefs, and (b) the
-- match-read can be wired, both activating automatically once vendor tagging
-- coverage exists. Additive + safe on the live pilot — nothing reads/writes it
-- yet, no behavior change.
--
-- Symmetric with vendor_service_attributes: same attribute_payload JSONB shape
-- + GIN(jsonb_path_ops) so the couple pref ⋈ vendor payload containment query
-- is cheap in either direction.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_vendor_preferences (
  event_id          UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  canonical_service TEXT NOT NULL
                    REFERENCES public.canonical_service_schemas(canonical_service)
                    ON DELETE RESTRICT,
  -- The couple's per-category preference values, keyed identically to the
  -- vendor side's attribute_payload (e.g. {"dietary_accommodations":["halal"]}).
  attribute_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The schema version the couple's payload was captured against (mirrors the
  -- vendor side · lets a future migration re-map if a category schema changes).
  schema_version_at_capture INT NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, canonical_service)
);

-- @> containment for the preference ⋈ vendor-facet match (Layer-B sort).
CREATE INDEX IF NOT EXISTS event_vendor_preferences_payload_gin
  ON public.event_vendor_preferences USING GIN (attribute_payload jsonb_path_ops);

ALTER TABLE public.event_vendor_preferences ENABLE ROW LEVEL SECURITY;

-- Hosts of the event read + write their own event's preferences; admins all.
-- Uses the canonical public.current_event_ids() helper (couple reads) +
-- public.is_admin() — same pattern as other host-scoped event tables.
DROP POLICY IF EXISTS event_vendor_preferences_host_select ON public.event_vendor_preferences;
CREATE POLICY event_vendor_preferences_host_select
  ON public.event_vendor_preferences FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_vendor_preferences_host_write ON public.event_vendor_preferences;
CREATE POLICY event_vendor_preferences_host_write
  ON public.event_vendor_preferences FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.event_vendor_preferences IS
  'Couple-side per-category match preferences — mirror of vendor_service_attributes. attribute_payload @> the vendor side drives the Layer-B "matches your preference" sort (Vendor_Match_Personalization_2026-06-01). Foundation shipped 2026-06-02; capture UI + match-read activate once vendor facet tagging coverage exists (vendor_service_attributes is empty in prod today).';
