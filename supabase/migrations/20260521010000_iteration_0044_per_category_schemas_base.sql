-- ============================================================================
-- 20260521010000_iteration_0044_per_category_schemas_base.sql
--
-- Iteration 0044 — Per-Category Vendor Attribute Schemas (base framework)
-- Spec corpus: 0044_per_category_schemas/0044_per_category_schemas.md
--
-- V1.1 wave PR 2 of 15. Ships the JSONB-schema framework — three tables, no
-- seed data. Seeds for the top 15 canonical_services land in a later PR;
-- consumer marketplaces (PR 7-13) read these schemas to drive per-category
-- filter UX.
--
-- The pattern: each canonical_service registers a JSONB schema describing
-- what attributes a vendor of that type fills (silhouettes for gown
-- designers, edit aesthetics for photographers, faith tags for caterers).
-- vendor_service_attributes stores per-vendor payloads validated against the
-- schema version they filled. Shared attribute groups (faith_compatibility,
-- pricing_signal, etc.) are reusable so we don't redefine the same fields
-- across 100+ services.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. canonical_service_schemas — one row per canonical_service
--
-- canonical_service is the stable string key (e.g. 'photography', 'catering',
-- 'bridal_gown_custom'). schema_version increments when a field is added or
-- semantics change; vendors keep their schema_version_at_fill so we can
-- migrate them safely. JSONB columns hold the field definitions; the shape
-- is documented in spec § Schema (NOT enforced at the DB level — validation
-- runs in the server actions that read/write payloads, where TypeScript
-- types live).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.canonical_service_schemas (
  canonical_service          TEXT PRIMARY KEY,
  schema_version             INT NOT NULL DEFAULT 1,
  display_name_en            TEXT NOT NULL,
  display_name_tl            TEXT,
  display_name_ceb           TEXT,
  shared_attribute_groups    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  category_specific_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  filter_facets              JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_for_visibility    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ranking_signal_weights     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canonical_service_schemas_facets_gin
  ON public.canonical_service_schemas USING GIN (filter_facets jsonb_path_ops);

ALTER TABLE public.canonical_service_schemas ENABLE ROW LEVEL SECURITY;

-- Everyone reads schemas — couples need them to render marketplace filters;
-- vendors need them to render onboarding wizards; the public marketplace SSR
-- needs them too. Writes are admin-only because schema edits ripple across
-- every vendor of that category.
DROP POLICY IF EXISTS canonical_service_schemas_read_all ON public.canonical_service_schemas;
CREATE POLICY canonical_service_schemas_read_all
  ON public.canonical_service_schemas FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS canonical_service_schemas_admin_write ON public.canonical_service_schemas;
CREATE POLICY canonical_service_schemas_admin_write
  ON public.canonical_service_schemas FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. shared_attribute_groups — reusable attribute sets
--
-- Examples (seeded in PR 5): faith_compatibility, dietary_accommodations,
-- geographic_service_areas, pricing_signal, vendor_credentials. A
-- canonical_service_schemas row references these by group_name; the same
-- group is inherited by every consumable category to avoid redefining
-- "halal_certified" 9 times.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_attribute_groups (
  group_name       TEXT PRIMARY KEY,
  display_name_en  TEXT NOT NULL,
  display_name_tl  TEXT,
  attributes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shared_attribute_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_attribute_groups_read_all ON public.shared_attribute_groups;
CREATE POLICY shared_attribute_groups_read_all
  ON public.shared_attribute_groups FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS shared_attribute_groups_admin_write ON public.shared_attribute_groups;
CREATE POLICY shared_attribute_groups_admin_write
  ON public.shared_attribute_groups FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. vendor_service_attributes — per-vendor per-category attribute payloads
--
-- One row per (vendor_profile_id, canonical_service). attribute_payload is
-- the JSONB vendor-filled values; schema_version_at_fill is captured at
-- write time so a schema upgrade doesn't silently invalidate existing
-- payloads. completeness_score (0-100) and meets_visibility_minimum are
-- computed by the server action that writes the payload — kept as plain
-- columns rather than generated so the math can evolve without an ALTER.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_service_attributes (
  vendor_profile_id         UUID NOT NULL
                            REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  canonical_service         TEXT NOT NULL
                            REFERENCES public.canonical_service_schemas(canonical_service)
                            ON DELETE RESTRICT,
  attribute_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version_at_fill    INT NOT NULL DEFAULT 1,
  completeness_score        INT NOT NULL DEFAULT 0
                            CHECK (completeness_score BETWEEN 0 AND 100),
  meets_visibility_minimum  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, canonical_service)
);

-- Marketplace queries fetch by canonical_service AND meets_visibility_minimum;
-- a partial index keeps the working set tiny since most vendors don't meet
-- the minimum on day 1 of joining.
CREATE INDEX IF NOT EXISTS vendor_attrs_visibility_idx
  ON public.vendor_service_attributes (canonical_service, meets_visibility_minimum)
  WHERE meets_visibility_minimum = TRUE;

CREATE INDEX IF NOT EXISTS vendor_attrs_completeness_idx
  ON public.vendor_service_attributes (canonical_service, completeness_score DESC);

-- jsonb_path_ops gives @> faceted queries (e.g.
-- "attribute_payload @> '{\"cuisine_specialties\":[\"halal_specialty\"]}'")
-- the cheapest possible index path for marketplace filter sidebars.
CREATE INDEX IF NOT EXISTS vendor_attrs_payload_gin
  ON public.vendor_service_attributes USING GIN (attribute_payload jsonb_path_ops);

ALTER TABLE public.vendor_service_attributes ENABLE ROW LEVEL SECURITY;

-- Vendor-owner write: the vendor (auth.uid()) must own the vendor_profile
-- row this attribute payload links to. We resolve through vendor_profiles
-- rather than caching the user_id here because vendor_profiles already owns
-- the canonical user→vendor mapping.
DROP POLICY IF EXISTS vendor_attrs_owner_write ON public.vendor_service_attributes;
CREATE POLICY vendor_attrs_owner_write
  ON public.vendor_service_attributes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_service_attributes.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_service_attributes.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

-- Marketplace read: anyone (anon + auth) sees rows that meet the visibility
-- minimum. Without this couples couldn't browse vendors. Admins and the
-- owning vendor see all rows regardless of visibility (for dashboards).
DROP POLICY IF EXISTS vendor_attrs_public_read_visible ON public.vendor_service_attributes;
CREATE POLICY vendor_attrs_public_read_visible
  ON public.vendor_service_attributes FOR SELECT
  TO anon, authenticated
  USING (
    meets_visibility_minimum = TRUE
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_service_attributes.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

-- Admin override for moderation / backfills.
DROP POLICY IF EXISTS vendor_attrs_admin_all ON public.vendor_service_attributes;
CREATE POLICY vendor_attrs_admin_all
  ON public.vendor_service_attributes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. compute_attribute_completeness — helper for the write-side server action
--
-- Counts how many of the schema's category_specific_attributes appear as
-- non-null/non-empty keys in the payload and returns 0-100. Kept here in SQL
-- rather than TS so admin queries and triggers can call it directly without
-- a round trip. The server action that writes vendor_service_attributes
-- calls this and writes the result into completeness_score; the function
-- itself is read-only and side-effect free.
--
-- "Filled" definition matches what the spec UX considers complete:
--   • non-null value
--   • non-empty array (for multi_select)
--   • non-empty string (for text)
-- Empty objects and the number 0 count as filled.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_attribute_completeness(
  payload JSONB,
  schema  JSONB
) RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  field_key TEXT;
  field_val JSONB;
  total_fields INT := 0;
  filled_fields INT := 0;
BEGIN
  IF schema IS NULL OR jsonb_typeof(schema) <> 'object' THEN
    RETURN 0;
  END IF;

  FOR field_key IN SELECT jsonb_object_keys(schema) LOOP
    total_fields := total_fields + 1;
    field_val := payload -> field_key;
    IF field_val IS NULL OR field_val = 'null'::jsonb THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(field_val) = 'string' AND length(trim(field_val #>> '{}')) = 0 THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(field_val) = 'array' AND jsonb_array_length(field_val) = 0 THEN
      CONTINUE;
    END IF;
    filled_fields := filled_fields + 1;
  END LOOP;

  IF total_fields = 0 THEN
    RETURN 0;
  END IF;

  RETURN (filled_fields * 100) / total_fields;
END;
$$;

COMMIT;
