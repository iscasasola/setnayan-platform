-- ============================================================================
-- 20270725802892_event_egift_methods.sql
--
-- Pabuya · E-Gifts / digital "money dance" — the couple's own e-gift
-- destinations. (Kasama + Pabuya event-site routes · memory
-- project_setnayan_kasama_pabuya · prototype Kasama_Pabuya_EventSite_2026-07-11.)
--
-- CORE INVARIANT (load-bearing): Setnayan NEVER holds or touches money. The
-- couple connects their OWN GCash / Maya / bank / PayPal handles; guests scan
-- the couple's own QR codes and send money DIRECTLY to the couple. This table
-- only stores where-to-send display data (a label, an account name, a handle,
-- and an optional uploaded QR image) — there is NO amount column, NO order
-- row, NO ledger, NO settlement state. Nothing here moves value.
--
-- One row per e-gift destination. A couple typically adds 1–4 (e.g. a GCash
-- QR, a Maya QR, a bank transfer note, a PayPal.me link). The public guest
-- surface (/[slug]/pabuya) renders the ENABLED rows in sort_order; the couple
-- manages the full set from /dashboard/[eventId]/pabuya.
--
-- Schema design mirrors event_sponsors (20260604040000): a UUID PK for
-- internal joins + a S89-prefixed public_id external handle (canonical entity
-- ID convention · generate_public_id), event_id FK ON DELETE CASCADE,
-- sort_order for couple-controlled ordering, and a per-table updated_at
-- trigger. The uploaded QR image is stored as the tagged `r2://bucket/key`
-- string (lib/uploads.ts convention) in a TEXT column — NOT split into
-- bucket+key columns — matching logo_url / payment_screenshot_url et al.
--
-- RLS: hosts (event_moderators · not removed) + legacy event_members 'couple'
-- + admin can CRUD their event's rows (Pattern B, event_sponsors idiom). There
-- is intentionally NO `TO anon` policy: the public /[slug]/pabuya page reads
-- via the service-role admin client behind the published-visibility gate
-- (canViewSlugEvent / landing_page_visibility <> 'private'), exactly like the
-- Live Wall / Auto-Recap / Editorial public doors. An anon RLS policy here
-- would be broken anyway — events itself has no anon-read policy, so an
-- EXISTS-against-events subquery would always be false under the anon role.
-- Public-read "gated to published events only" is therefore enforced at the
-- application layer (the service-role read + visibility gate), which is the
-- shipped convention for every public /[slug] sub-route.
--
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS) — safe to re-run.
-- Apply with `supabase db push --db-url "$SUPABASE_DB_URL"` (no auto-apply).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_egift_methods table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_egift_methods (
  egift_method_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- S89Y-<10 char Crockford> external handle (canonical entity-ID convention).
  public_id           TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('Y'),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- Which rail this destination is. Drives the guest-surface icon + copy.
  method_kind         TEXT NOT NULL CHECK (method_kind IN (
    'gcash',
    'maya',
    'bank',
    'paypal',
    'other'
  )),

  -- Couple-chosen display label ("GCash", "BPI Savings", "PayPal", "Maya").
  label               TEXT NOT NULL,
  -- Name on the receiving account, shown so guests can confirm before sending.
  account_name        TEXT,
  -- The handle guests act on: a GCash/Maya number, a bank account number, or a
  -- PayPal.me URL. Free text — validated + length-capped in the server action.
  handle              TEXT,
  -- Uploaded QR image as the tagged `r2://bucket/key` ref (lib/uploads.ts).
  -- NULL when the couple provides only a number/handle and no QR image.
  qr_r2_key           TEXT,
  -- Optional short instruction ("Please put our names in the message").
  note                TEXT,

  -- Couple can hide a destination without deleting it. Only enabled rows show
  -- on the public guest surface.
  is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  -- Couple-controlled ordering on the guest surface (ascending).
  sort_order          INTEGER NOT NULL DEFAULT 0,

  created_by_user_id  UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The two hot reads — the couple dashboard list + the public guest surface —
-- both fetch one event's rows in sort order. This composite index serves both.
CREATE INDEX IF NOT EXISTS event_egift_methods_event_idx
  ON public.event_egift_methods(event_id, sort_order);

ALTER TABLE public.event_egift_methods ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_egift_methods IS
  'Pabuya e-gift destinations — where guests send money DIRECTLY to the couple''s own account. Display-only (label + account name + handle + optional QR image); no amount, order, ledger, or settlement — Setnayan never holds money. Public /[slug]/pabuya reads enabled rows via service-role behind the published-visibility gate.';

-- ----------------------------------------------------------------------------
-- 2. RLS — hosts (moderators + legacy couple) + admin CRUD; NO anon policy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS event_egift_methods_host_all ON public.event_egift_methods;
CREATE POLICY event_egift_methods_host_all ON public.event_egift_methods
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_event_egift_methods_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_egift_methods_set_updated_at ON public.event_egift_methods;
CREATE TRIGGER event_egift_methods_set_updated_at
  BEFORE UPDATE ON public.event_egift_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_event_egift_methods_set_updated_at();

COMMIT;
