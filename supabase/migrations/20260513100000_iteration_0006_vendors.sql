-- ============================================================================
-- 20260513100000_iteration_0006_vendors.sql
-- Iteration 0006 Vendors Management MVP — couple side only.
--
-- Adds:
--   • `vendor_category` enum (28 canonical PH wedding service categories)
--   • `vendor_status` enum (6-stage readiness tracker per spec)
--   • `event_vendors` — per-event vendor entry (loose record, NOT a vendor
--      profile; vendor-side profiles ship in iteration 0022). Stores
--      category, contact, status, total cost PHP, deposit paid PHP, notes.
--   • Pattern B RLS (couples read + write)
--
-- Deferred:
--   • Payment milestones (3-line spec) — V1 collapses to total + deposit
--   • Crew meals counts
--   • Vendor profiles (iteration 0022)
--   • Linking to a public vendor catalog (search/filter from a marketplace)
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_category — 28 entries from the spec
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.vendor_category AS ENUM (
    'venue',
    'catering',
    'photographer',
    'videographer',
    'florist',
    'cake_maker',
    'host_emcee',
    'band_dj',
    'string_quartet',
    'choir',
    'officiant',
    'planner_coordinator',
    'makeup_artist',
    'hair_stylist',
    'gown_designer',
    'suit_designer',
    'rings',
    'invitations_stationery',
    'transportation',
    'lights_and_sound',
    'led_screens',
    'photobooth',
    'mobile_bar',
    'church_fees',
    'reception_decor',
    'security',
    'gifts_and_giveaways',
    'misc'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. vendor_status — 6-stage readiness tracker
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.vendor_status AS ENUM (
    'considering',
    'shortlisted',
    'contracted',
    'deposit_paid',
    'delivered',
    'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. event_vendors
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_vendors (
  vendor_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('V'),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  category            public.vendor_category NOT NULL,
  vendor_name         TEXT NOT NULL,
  contact_email       TEXT,
  contact_phone       TEXT,
  status              public.vendor_status NOT NULL DEFAULT 'considering',
  total_cost_php      NUMERIC(12,2),
  deposit_paid_php    NUMERIC(12,2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (total_cost_php IS NULL OR total_cost_php >= 0),
  CHECK (deposit_paid_php IS NULL OR deposit_paid_php >= 0),
  CHECK (
    deposit_paid_php IS NULL OR total_cost_php IS NULL
    OR deposit_paid_php <= total_cost_php
  )
);

CREATE INDEX IF NOT EXISTS event_vendors_event_id_idx ON public.event_vendors(event_id);
CREATE INDEX IF NOT EXISTS event_vendors_category_idx ON public.event_vendors(category);
CREATE INDEX IF NOT EXISTS event_vendors_status_idx ON public.event_vendors(status);

ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_vendors_couple_read ON public.event_vendors;
CREATE POLICY event_vendors_couple_read
  ON public.event_vendors FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_vendors_couple_write ON public.event_vendors;
CREATE POLICY event_vendors_couple_write
  ON public.event_vendors FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
