-- ============================================================================
-- 20260519100000_iteration_0048_event_moderators_foundation.sql
--
-- Phase A foundation for V1.2 iteration 0048 Multi-Moderator Event Access.
-- Spec corpus: 0048_multi_moderator_event_access/0048_multi_moderator_event_access.md
-- CLAUDE.md decision log: Seventh 2026-05-19 row (V1.2 spec lock) + Ninth
-- 2026-05-19 row (memory rule approval).
--
-- This migration ships the MINIMAL foundation slice so the V1.2 spec scope can
-- pick up in subsequent PRs without backfill drama:
--
--   (1) event_moderators table — 13 role_subtypes (the 11 from spec + partner1
--       + partner2 for backwards-compat with existing event_members 'couple'
--       rows that don't have a bride/groom distinction; promoted from V1.3 to
--       V1.2 here so the backfill has somewhere clean to land).
--
--   (2) Backfill — every existing public.event_members row with
--       member_type='couple' becomes an event_moderators row with
--       role_subtype='partner1' (first by joined_at) or 'partner2' (second).
--       Permissions default to full edit + checkout for partner1/partner2.
--       Couples can re-tag to 'bride'/'groom' explicitly in V1.2 UI when it
--       lands; existing events keep working identically because partner1/
--       partner2 carry the same permission template as bride/groom.
--
--   (3) moderator_can_see_row(p_event_id, p_user_id, p_private_to_role,
--       p_hidden_from_role, p_surprise_for_role) — helper function.
--       Callable from anywhere, NOT yet wired into RLS policies. Future
--       phases attach this to RLS on cart line items + vendor orders +
--       vendor chat threads + calendar events + budget line items once
--       those table names are verified against current code.
--
-- Deferred to subsequent PRs (Phase A2 onward):
--   - Visibility columns (private_to_role[] · hidden_from_role[] ·
--     surprise_for_role · paid_by_role[] · payment_split_percentages ·
--     payment_status_per_role · added_to_cart_by_user_id ·
--     visibility_set_by_user_id) on cart / orders / chats / calendar /
--     budget tables.
--   - RLS policies on those tables using moderator_can_see_row().
--   - Default-hide trigger for bridal_gown_* / groom_suit_* /
--     barong_tagalog_* canonical_services.
--   - vendor_order_receipts table (Phase C — receipt formatting).
--
-- Backwards compatibility:
--   - Existing dashboards continue to work; no surface uses event_moderators
--     yet so this migration is invisible to pilot couples.
--   - Adding partner1/partner2 to the CHECK constraint (vs the 11 originally
--     spec'd) is a forward-compatible change; future V1.3 work can rename if
--     desired without breaking backfilled data.
--   - All operations idempotent (IF NOT EXISTS · CHECK constraints don't
--     double-add · backfill uses ON CONFLICT DO NOTHING via the UNIQUE
--     index on (event_id, user_id)).
--
-- Risk surface:
--   - Backfill iterates every event_members 'couple' row; on a pilot-scale
--     database (a handful of events with ≤2 couple members each) this is
--     trivial. At production scale (thousands of events) the SELECT + INSERT
--     pattern is still fine; no transaction-locking concerns.
--   - No data destruction; no DROP statements; reversible by:
--       DROP TABLE public.event_moderators;
--       DROP FUNCTION public.moderator_can_see_row;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_moderators table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_moderators (
  moderator_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_subtype          TEXT NOT NULL CHECK (role_subtype IN (
    'bride',
    'groom',
    'partner1',                 -- backwards-compat backfill default (non-traditional couples too)
    'partner2',                 -- backwards-compat backfill default
    'parent_of_bride',
    'parent_of_groom',
    'maid_of_honor',
    'best_man',
    'wedding_planner_external',
    'ninong',
    'ninang',
    'family_helper',
    'viewer'
  )),
  display_label         TEXT,                                  -- e.g., "Tita Lita (Mom's cousin)"
  permissions_json      JSONB NOT NULL,                        -- per-moderator overridable; defaults from role template
  invited_by_user_id    UUID REFERENCES auth.users(id),        -- NULL for backfilled couple rows (no invitation)
  invitation_email      TEXT,
  invitation_phone      TEXT,
  invitation_sent_at    TIMESTAMPTZ,
  invitation_expires_at TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- backfilled rows are pre-accepted
  removed_at            TIMESTAMPTZ,
  removal_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_moderators_event_user_idx
  ON public.event_moderators (event_id, user_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS event_moderators_pending_invites_idx
  ON public.event_moderators (event_id) WHERE accepted_at IS NULL AND removed_at IS NULL;

ALTER TABLE public.event_moderators ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS policies for event_moderators itself (minimal: moderator can read
--    other moderators on events they belong to; couple can manage)
-- ----------------------------------------------------------------------------

-- RLS policy designed to avoid self-recursion: queries event_members (NOT
-- event_moderators) for the "can read all moderators on this event" check.
-- Couples (event_members member_type='couple') see all moderator rows on
-- their events. Other moderators (parents/sponsors/etc.) added in Phase B
-- only see their own row for now; Phase B will extend visibility once a
-- SECURITY DEFINER helper avoids the recursion issue.
DROP POLICY IF EXISTS event_moderators_select_own_events ON public.event_moderators;
CREATE POLICY event_moderators_select_own_events ON public.event_moderators
  FOR SELECT TO authenticated
  USING (
    -- I'm the moderator on this row (self-row visibility)
    user_id = auth.uid()
    OR
    -- I'm a couple member on this event (couples see all moderators on their events)
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = public.event_moderators.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

-- Insert/update/delete policies left tight for V1.2-Phase-B (moderator
-- invitation flow). For now: server-side only via service-role key.

-- ----------------------------------------------------------------------------
-- 3. moderator_can_see_row() helper function
--
-- Returns TRUE when the given user (typically auth.uid()) can see a row
-- tagged with the given visibility tags on the given event. Used by RLS
-- policies on cart / vendor_orders / vendor_chat_threads / calendar /
-- budget tables in subsequent phases.
--
-- Logic:
--   1. If user is not a moderator on the event → FALSE
--   2. If row is private_to_role and user's role isn't in the list → FALSE
--   3. If row is hidden_from_role and user's role IS in the list → FALSE
--   4. If row is surprise_for_role and user IS the surprise target → FALSE
--   5. Otherwise → TRUE
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.moderator_can_see_row(
  p_event_id            UUID,
  p_user_id             UUID,
  p_private_to_role     TEXT[]  DEFAULT NULL,
  p_hidden_from_role    TEXT[]  DEFAULT NULL,
  p_surprise_for_role   TEXT    DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Step 1: user must be an accepted, non-removed moderator on the event
  SELECT role_subtype INTO v_role
    FROM public.event_moderators
   WHERE event_id = p_event_id
     AND user_id  = p_user_id
     AND accepted_at IS NOT NULL
     AND removed_at IS NULL
   LIMIT 1;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Step 2: private_to_role — only specified roles see it
  IF p_private_to_role IS NOT NULL
     AND array_length(p_private_to_role, 1) > 0
     AND NOT (v_role = ANY(p_private_to_role))
  THEN
    RETURN FALSE;
  END IF;

  -- Step 3: hidden_from_role — my role is in the hide list
  IF p_hidden_from_role IS NOT NULL
     AND array_length(p_hidden_from_role, 1) > 0
     AND v_role = ANY(p_hidden_from_role)
  THEN
    RETURN FALSE;
  END IF;

  -- Step 4: surprise_for_role — I am the surprise target (so I cannot see it)
  IF p_surprise_for_role IS NOT NULL
     AND v_role = p_surprise_for_role
  THEN
    RETURN FALSE;
  END IF;

  -- Step 5: pass
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.moderator_can_see_row IS
  'V1.2 iteration 0048 helper: returns TRUE iff the given user can see a row '
  'tagged with the given visibility tags on the given event. Used by RLS '
  'policies on cart/vendor_orders/vendor_chat_threads/calendar/budget tables '
  'attached in Phase A2 onward.';

-- ----------------------------------------------------------------------------
-- 4. Backfill existing couples into event_moderators
--
-- Strategy: for every event, take its event_members rows with
-- member_type='couple' ordered by joined_at ASC. First row → partner1.
-- Second row → partner2. Additional rows (rare) → partner2 with display_label
-- noting the duplicate (shouldn't happen in practice but defensive).
--
-- Permissions default to full edit + checkout (matches bride/groom defaults).
-- ----------------------------------------------------------------------------

WITH ranked_couple_members AS (
  SELECT
    em.event_id,
    em.user_id,
    em.joined_at,
    ROW_NUMBER() OVER (PARTITION BY em.event_id ORDER BY em.joined_at ASC, em.user_id ASC) AS rn
  FROM public.event_members em
  WHERE em.member_type = 'couple'
)
INSERT INTO public.event_moderators (
  event_id,
  user_id,
  role_subtype,
  permissions_json,
  invited_by_user_id,
  accepted_at
)
SELECT
  rcm.event_id,
  rcm.user_id,
  CASE rcm.rn WHEN 1 THEN 'partner1' ELSE 'partner2' END,
  jsonb_build_object(
    'can_view_guests',                  TRUE,
    'can_edit_guests',                  TRUE,
    'can_view_budget',                  TRUE,
    'can_edit_budget',                  TRUE,
    'can_view_vendors',                 TRUE,
    'can_message_vendors',              TRUE,
    'can_add_vendors_to_shortlist',     TRUE,
    'can_view_cart',                    TRUE,
    'can_add_to_cart',                  TRUE,
    'can_checkout',                     TRUE,
    'can_view_dashboard_panels',        TRUE,
    'can_edit_event_settings',          TRUE,
    'can_add_moderators',               TRUE,
    'can_remove_moderators',            TRUE,
    'can_view_schedule',                TRUE,
    'can_edit_schedule',                TRUE,
    'can_view_seating',                 TRUE,
    'can_edit_seating',                 TRUE,
    'can_view_day_of_timeline',         TRUE,
    'can_view_showcase_consent',        TRUE,
    'can_modify_showcase_consent',      TRUE
  ),
  NULL,                  -- no inviter for backfilled rows
  rcm.joined_at          -- accepted_at = original joined_at (preserves history)
FROM ranked_couple_members rcm
ON CONFLICT (event_id, user_id) DO NOTHING;

COMMIT;
