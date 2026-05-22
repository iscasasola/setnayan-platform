-- ============================================================================
-- 20260604040000_event_sponsors_table.sql
--
-- Principal + Secondary Sponsor coordination · Filipino-cultural V1
-- Per CLAUDE.md 2026-05-22 row "Principal Sponsor list builder"
--
-- Filipino Catholic / Civil / cultural weddings traditionally invite 2–12
-- pairs of principal sponsors (ninong/ninang) plus 4 fixed pairs of secondary
-- sponsors (cord · veil · coin/arrhae · candle). No foreign wedding platform
-- (The Knot · Zola · Joy · Bridestory · Bride and Breakfast · WedMeGood)
-- ships this workflow as a first-class surface — this is structural cultural
-- moat for Setnayan.
--
-- Flow:
--   1. Host adds candidate sponsors to event_sponsors (pending invitation).
--   2. Host sends formal pamamanhikan-style invitation (V1: clipboard-copy
--      template; V1.x: Resend email via 0028).
--   3. Sponsor responds — host marks accepted / declined.
--   4. On acceptance: auto-link to guests row (role='principal_sponsor' for
--      principals · or candle_sponsor / veil_sponsor / cord_sponsor /
--      coin_sponsor for secondaries). Note: the guest_role enum uses ONE
--      'principal_sponsor' value with side distinguishing ninong / ninang;
--      the four secondary sponsor roles each have their own enum value
--      (per migration 20260513010000_iteration_0001_guests.sql lines 33-37).
--
-- Schema design:
--   - One row per individual sponsor (NOT per pair). Pairing is via
--     pair_index for principals; secondary sponsors don't share pair_index
--     across cord/veil/coin/candle tiers (each tier has 2 slots, but they're
--     two independent invitations — one might accept while the other declines).
--   - pair_index is NULL for secondary sponsors (no pair coupling) AND can be
--     NULL for solo principal sponsors (rare exception — officiant blessing).
--   - linked_guest_id is set after acceptance so the guests row + the
--     event_sponsors row stay in sync if the host edits the guests row
--     directly (display_name change, RSVP update, etc.).
--
-- RLS: hosts (event_moderators rows · not removed_at) can manage all rows
-- on their event. Falls back to event_members 'couple' check for backwards-
-- compat with events whose only host membership is the legacy V1 row.
--
-- Forward-compat:
--   - Future iteration may add separate ninong / ninang guest_role enum
--     values (currently distinguished only by side). When that lands, the
--     auto-link logic in actions.ts updates accordingly without schema
--     migration here.
--   - principal_sponsor_target_pairs is NOT stored on events — the host
--     simply adds N pairs and the UI derives the target from pair_index
--     max + 1 (or surfaces a target picker stored in localStorage). Keeps
--     the schema minimal.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_sponsors table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- Pair grouping for principal sponsors. NULL for secondaries (each cord /
  -- veil / coin / candle slot is independent) AND for the rare solo principal
  -- (officiant blessing exception per Filipino practice in some parishes).
  pair_index            INTEGER,

  sponsor_tier          TEXT NOT NULL CHECK (sponsor_tier IN (
    'principal',
    'cord',
    'veil',
    'coin',
    'candle'
  )),
  side                  TEXT NOT NULL CHECK (side IN ('groom', 'bride', 'neutral')),

  -- Person info — may not be a Setnayan user / guest yet at insert time.
  full_name             TEXT NOT NULL,
  relationship_note     TEXT,   -- "Tito Mike (mom's brother)"
  email                 TEXT,
  phone                 TEXT,

  invitation_status     TEXT NOT NULL DEFAULT 'pending' CHECK (invitation_status IN (
    'pending',
    'invited',
    'accepted',
    'declined'
  )),
  invitation_sent_at    TIMESTAMPTZ,
  responded_at          TIMESTAMPTZ,
  decline_note          TEXT,

  -- Optional auto-link to guests row when accepted. Set in actions.ts on
  -- acceptance; preserves the link if the host later edits the guests row.
  linked_guest_id       UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,

  created_by_user_id    UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_sponsors_event_idx
  ON public.event_sponsors(event_id);

CREATE INDEX IF NOT EXISTS event_sponsors_tier_idx
  ON public.event_sponsors(event_id, sponsor_tier);

CREATE INDEX IF NOT EXISTS event_sponsors_status_idx
  ON public.event_sponsors(event_id, invitation_status);

CREATE INDEX IF NOT EXISTS event_sponsors_linked_guest_idx
  ON public.event_sponsors(linked_guest_id) WHERE linked_guest_id IS NOT NULL;

ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS policies — hosts can manage; admins can read
-- ----------------------------------------------------------------------------

-- Hosts (event_moderators OR legacy event_members couple) can SELECT, INSERT,
-- UPDATE, DELETE on rows for their events.
DROP POLICY IF EXISTS event_sponsors_host_all ON public.event_sponsors;
CREATE POLICY event_sponsors_host_all ON public.event_sponsors
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

CREATE OR REPLACE FUNCTION public.tg_event_sponsors_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_sponsors_set_updated_at ON public.event_sponsors;
CREATE TRIGGER event_sponsors_set_updated_at
  BEFORE UPDATE ON public.event_sponsors
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_event_sponsors_set_updated_at();

COMMIT;

-- ============================================================================
-- guest_role enum compatibility note (no DDL change needed)
--
-- The guest_role enum already covers every sponsor tier used by this
-- iteration:
--   - 'principal_sponsor'  → ninong (side='groom') / ninang (side='bride')
--   - 'cord_sponsor'       → cord pair (side='neutral' or per couple's pick)
--   - 'veil_sponsor'       → veil pair
--   - 'coin_sponsor'       → coin/arrhae pair
--   - 'candle_sponsor'     → candle pair
--
-- Defined in migration 20260513010000_iteration_0001_guests.sql lines 33-37.
-- ============================================================================
