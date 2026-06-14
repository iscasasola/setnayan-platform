-- ============================================================================
-- 20261211000000_adaptive_pax_pricing_columns.sql
--
-- ADAPTIVE PAX PRICING — Phase 1 (schema only · no behavior change).
--
-- Threads ONE guest-count number from the couple's guest list through vendor
-- inquiries into per-vendor pricing and the budget. Owner-designed + locked
-- 2026-06-13 (see DECISION_LOG). The model:
--
--   * events.estimated_pax (UNCHANGED) = the couple's "minimum pax" = the
--     pricing FLOOR. Stays couple-editable; never auto-mutates.
--   * live_pax = max(estimated_pax, confirmed-attending headcount). Computed in
--     code (no cache column in V1). Only SURE (rsvp_status='attending') guests
--     push past the floor — maybes/no-replies never move the price.
--   * Once live_pax tops the floor, the new count is sent to vendors (new
--     inquiries snapshot it; open threads get it pushed) and the couple is told
--     "some prices may change". A vendor MAY set an optional per-added-guest
--     rate; if blank, there is NO surcharge.
--   * The number a vendor sees is fully live (up AND down), but any *confirmed*
--     cost change goes through a vendor confirm in BOTH directions — nothing
--     committed shifts silently.
--   * Couples watch it as realtime adaptive pricing (default) or final-only.
--     The number auto-FINALIZES at the guest-list edit deadline; after that the
--     list locks and the price is binding.
--
-- This migration ONLY adds the columns the later phases read. Every column is
-- NULL-safe / sane-defaulted so existing rows mean "flat price, no surcharge,
-- no snapshot, realtime view, attending-basis" — i.e. today's behavior exactly.
-- No reads are wired here; phases 2-6 light these up. All columns sit on tables
-- that already have RLS, so row access is unchanged (columns inherit the
-- table's policies — no new policy needed).
--
-- Canonical: DECISION_LOG 2026-06-13 "Adaptive Pax Pricing"; companion repo
-- CHANGELOG + STATUS 2026-06-13.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- events: the couple-side knobs for the adaptive model.
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  -- What counts as a "person" for the meter + the vendor-facing live_pax.
  -- Owner-locked to 'attending' (sure guests only); the column keeps the basis
  -- explicit + changeable without a future migration.
  ADD COLUMN IF NOT EXISTS headcount_basis TEXT NOT NULL DEFAULT 'attending'
    CHECK (headcount_basis IN ('attending', 'attending_plus_maybe', 'invited')),
  -- How the couple watches their adaptive costs: 'realtime' = running preview
  -- updates as confirmed attendance passes the floor (default); 'final_only' =
  -- costs hold at the floor until finalization, then settle in one step.
  ADD COLUMN IF NOT EXISTS adaptive_pricing_mode TEXT NOT NULL DEFAULT 'realtime'
    CHECK (adaptive_pricing_mode IN ('realtime', 'final_only')),
  -- Last date the couple may edit the guest list. After this, the count
  -- auto-finalizes and the price becomes binding. NULL = no deadline set yet.
  ADD COLUMN IF NOT EXISTS guest_list_edit_deadline DATE,
  -- Stamped when the final guest count locks (at/after the edit deadline). NULL
  -- = still open / adapting.
  ADD COLUMN IF NOT EXISTS guest_count_locked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.headcount_basis IS
  'Which guests count toward the live pax + the pax sent to vendors. attending (locked default, sure guests only) | attending_plus_maybe | invited. live_pax = max(estimated_pax, headcount-on-this-basis).';
COMMENT ON COLUMN public.events.adaptive_pricing_mode IS
  'Couple''s pricing view: realtime (default; running preview as count grows) | final_only (hold at floor, settle once at finalization). Adaptive Pax Pricing, 2026-06-13.';
COMMENT ON COLUMN public.events.guest_list_edit_deadline IS
  'Last date the couple can edit the guest list; after it the count auto-finalizes and pricing becomes binding. NULL = unset.';
COMMENT ON COLUMN public.events.guest_count_locked_at IS
  'Set when the final guest count locks at/after guest_list_edit_deadline. NULL = still adapting.';

-- ---------------------------------------------------------------------------
-- vendor_services: the vendor's OPTIONAL per-added-guest surcharge rate.
-- Single flat rate (not a tier ladder) per owner. Sits beside starting_price_php
-- and is PHP-integer to match it (not centavos). NULL/blank = no surcharge ever.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS added_pax_price_php INTEGER
    CHECK (added_pax_price_php IS NULL OR added_pax_price_php >= 0),
  -- Surcharge applies per this many added guests above the quote base
  -- (1 = per guest; e.g. 50 = per block of 50, mirroring PAPIC_GUEST).
  ADD COLUMN IF NOT EXISTS added_pax_block INTEGER NOT NULL DEFAULT 1
    CHECK (added_pax_block >= 1);

COMMENT ON COLUMN public.vendor_services.added_pax_price_php IS
  'Optional vendor surcharge in PHP per added-guest block above the quote base. NULL/blank = no extra charge for added pax (owner fallback). Adaptive Pax Pricing, 2026-06-13.';
COMMENT ON COLUMN public.vendor_services.added_pax_block IS
  'Number of added guests per surcharge step (1 = per guest). Surcharge = ceil(max(0, live_pax - quote_base) / added_pax_block) * added_pax_price_php.';

-- ---------------------------------------------------------------------------
-- chat_threads: the pax carried on a couple<->vendor inquiry.
-- pax_at_inquiry is the immutable snapshot at thread creation (the count the
-- vendor first quoted against); pax_current is the fully-live count pushed as
-- it changes (up AND down). Both inherit chat_threads' member-read RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS pax_at_inquiry INTEGER
    CHECK (pax_at_inquiry IS NULL OR pax_at_inquiry > 0),
  ADD COLUMN IF NOT EXISTS pax_current INTEGER
    CHECK (pax_current IS NULL OR pax_current > 0);

COMMENT ON COLUMN public.chat_threads.pax_at_inquiry IS
  'Immutable live_pax snapshot when this inquiry was created (the count the vendor first quoted against). NULL = pre-feature thread. Adaptive Pax Pricing, 2026-06-13.';
COMMENT ON COLUMN public.chat_threads.pax_current IS
  'Live_pax currently pushed to this (non-terminal) thread; fully live, tracks up and down. NULL = not yet pushed.';

-- ---------------------------------------------------------------------------
-- event_vendors: the per-booking pax basis + computed surcharge.
-- pax_quote_base = the count the base price (starting_price_php / total_cost_php
-- base) is anchored to; surcharge applies only ABOVE it. pax_surcharge_php =
-- the currently-applied, vendor-confirmed surcharge (NULL = vendor set no rate).
-- cost_basis_pax = the live_pax the current total_cost_php reflects, for the
-- "priced for N" display + staleness detection.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS pax_quote_base INTEGER
    CHECK (pax_quote_base IS NULL OR pax_quote_base > 0),
  ADD COLUMN IF NOT EXISTS pax_surcharge_php INTEGER
    CHECK (pax_surcharge_php IS NULL OR pax_surcharge_php >= 0),
  ADD COLUMN IF NOT EXISTS cost_basis_pax INTEGER
    CHECK (cost_basis_pax IS NULL OR cost_basis_pax > 0);

COMMENT ON COLUMN public.event_vendors.pax_quote_base IS
  'Guest count the vendor base price is anchored to (defaults from chat_threads.pax_at_inquiry at quote time). Surcharge applies only to live_pax above this. Adaptive Pax Pricing, 2026-06-13.';
COMMENT ON COLUMN public.event_vendors.pax_surcharge_php IS
  'Currently-applied, vendor-confirmed per-pax surcharge in PHP, summed into total_cost_php. NULL = vendor set no added-pax rate (no surcharge).';
COMMENT ON COLUMN public.event_vendors.cost_basis_pax IS
  'The live_pax the current total_cost_php reflects. UI shows "priced for N"; when live_pax moves beyond this, the cost is flagged stale pending a confirm.';

COMMIT;
