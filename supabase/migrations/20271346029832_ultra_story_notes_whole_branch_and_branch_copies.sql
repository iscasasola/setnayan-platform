-- ultra_story_notes_whole_branch_and_branch_copies
-- Created via `pnpm migration:new`. ADD-ONLY and idempotent.
--
-- SIMPLER SUPPLIER PLANS — items (8) · (9) · (10), owner-approved 2026-11-14 (specs DECISION_LOG row
-- "SIMPLER SUPPLIER PLANS — APPROVED AS DRAWN, AND THE PLANS ARE NAMED PLUS · PRO · ULTRA"; drawing
-- artifact Eiwc64wF1VHLfZ52Sjbs8c sections 5–7).
--
--   (8) vendor_event_story_notes — an Ultra shop's own "In our words" note for ONE booked celebration, shown
--       on the shop's own page for that event (/v/<shop>/story/<event slug>). Everything else on that page is
--       READ from rows that already exist (the published story's gate, the shop's approved editorial media,
--       the couple's review); this is the only new fact, so it is the only new table.
--   (9) vendor_team_members.whole_branch_keys — "Whole branch" in Shop › Team › Who works what. A key is a
--       vendor_branches.branch_id as text, or 'main' for the cards with no branch. The person is still scoped by
--       vendor_service_agents (every existing read — agent_service_ids(), the clients list, the chat roster —
--       is unchanged); the trigger below only ADDS the rows for a card filed at that branch later.
--   (10) vendor_services.branch_copy_of + copy_vendor_service_to_branch() — "Copy to another branch". The copy
--       is the same service at another location: it does NOT use up a card (the create gate and the plan picker
--       skip rows with branch_copy_of set), has its own price, its own calendar (a new schedule pool) and its own
--       team (no agent rows are copied), and REFERENCES the same photos (no object is duplicated).
--
-- RLS: the new table is enabled at CREATE (canonical vendor-owned pattern through current_vendor_ids('admin'),
-- platform admins read through is_admin()). Both functions are SECURITY DEFINER with an explicit owner check,
-- the same way save_vendor_service is.

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- (8) "In our words"
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_event_story_notes (
  note_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  body               TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 600),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, event_id)
);

CREATE INDEX IF NOT EXISTS vendor_event_story_notes_event_idx
  ON public.vendor_event_story_notes (event_id);

ALTER TABLE public.vendor_event_story_notes ENABLE ROW LEVEL SECURITY;

-- Grants by column, the way this schema grants (a stranger never reads the table; the public page reads it
-- server-side with the service role).
REVOKE ALL ON public.vendor_event_story_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT (note_id, vendor_profile_id, event_id, body, created_at, updated_at)
  ON public.vendor_event_story_notes TO authenticated;
GRANT INSERT (vendor_profile_id, event_id, body, updated_at),
      UPDATE (body, updated_at),
      DELETE
  ON public.vendor_event_story_notes TO authenticated;
GRANT ALL ON public.vendor_event_story_notes TO service_role;

DROP POLICY IF EXISTS vendor_event_story_notes_vendor_manage ON public.vendor_event_story_notes;
CREATE POLICY vendor_event_story_notes_vendor_manage
  ON public.vendor_event_story_notes FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_event_story_notes_admin_read ON public.vendor_event_story_notes;
CREATE POLICY vendor_event_story_notes_admin_read
  ON public.vendor_event_story_notes FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.vendor_event_story_notes IS
  'Ultra story pages (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 8): a shop''s own "In our words" note for one booked celebration. Shown only on /v/<shop>/story/<event slug>, which renders only for a celebration the host has PUBLISHED (the same showcase gate as lib/realstories-vendor.ts: consent, slug, past the 30-day wait) and only while the shop is on Ultra. Written by the shop''s admins (current_vendor_ids(''admin'')); the public page reads it server-side.';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- (9) Whole branch
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_team_members
  ADD COLUMN IF NOT EXISTS whole_branch_keys TEXT[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_team_members_whole_branch_keys_len'
       AND conrelid = 'public.vendor_team_members'::regclass
  ) THEN
    ALTER TABLE public.vendor_team_members
      ADD CONSTRAINT vendor_team_members_whole_branch_keys_len
      CHECK (cardinality(whole_branch_keys) <= 64);
  END IF;
END $$;

-- Who may write it: the table's admin-write RLS policy (current_vendor_ids('admin')), unchanged. No new grant — the
-- table-level privileges already cover a new column (measured in production 2026-11-14).

COMMENT ON COLUMN public.vendor_team_members.whole_branch_keys IS
  'Shop › Team "Whole branch" (owner 2026-11-14, item 9): the branches this person works in full — a vendor_branches.branch_id as text, or ''main'' for cards filed under no branch. The person still sees exactly their vendor_service_agents rows; vendor_services_whole_branch_agents() adds the row for every card filed at such a branch later.';

CREATE OR REPLACE FUNCTION public.vendor_services_whole_branch_agents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id)
  SELECT NEW.vendor_service_id, m.vendor_team_member_id
    FROM public.vendor_team_members m
   WHERE m.vendor_profile_id = NEW.vendor_profile_id
     AND m.deactivated_at IS NULL
     AND COALESCE(NEW.branch_id::text, 'main') = ANY (m.whole_branch_keys)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_services_whole_branch_agents() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_services_whole_branch_agents() IS
  'Whole branch, including later cards (owner 2026-11-14, item 9): a card created at — or moved to — a branch a team member holds whole gets that member''s vendor_service_agents row. Only ADDS; unticking the branch is the Team action''s job.';

DROP TRIGGER IF EXISTS vendor_services_whole_branch_agents_trg ON public.vendor_services;
CREATE TRIGGER vendor_services_whole_branch_agents_trg
  AFTER INSERT OR UPDATE OF branch_id ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.vendor_services_whole_branch_agents();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- (10) Copy to another branch
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS branch_copy_of UUID NULL
  REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_services_branch_copy_of_idx
  ON public.vendor_services (branch_copy_of)
  WHERE branch_copy_of IS NOT NULL;

-- 🔒 ONLY THE COPY MAY SET IT. `authenticated` holds table-level UPDATE on vendor_services and the row policy is "your
-- own cards", so without this fence a shop could PATCH branch_copy_of onto any card through PostgREST and step outside
-- its card limit. Clearing it (the FK's ON DELETE SET NULL, or an admin) is always allowed; SETTING it is allowed only
-- inside copy_vendor_service_to_branch(), which raises a transaction-local flag first.
CREATE OR REPLACE FUNCTION public.only_a_branch_copy_sets_branch_copy_of()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_copy_of IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_copy_of IS DISTINCT FROM OLD.branch_copy_of)
     AND COALESCE(current_setting('setnayan.branch_copy', true), '') <> 'on' THEN
    RAISE EXCEPTION 'A card becomes a branch copy only through Copy to another branch.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.only_a_branch_copy_sets_branch_copy_of() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS only_a_branch_copy_sets_branch_copy_of_trg ON public.vendor_services;
CREATE TRIGGER only_a_branch_copy_sets_branch_copy_of_trg
  BEFORE INSERT OR UPDATE OF branch_copy_of ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.only_a_branch_copy_sets_branch_copy_of();

COMMENT ON COLUMN public.vendor_services.branch_copy_of IS
  'Copy to another branch (owner 2026-11-14, item 10): the card this one is the same service as, at another branch. A row with this set does NOT use up a card — the create gate (commitVendorService) and the plan picker (lib/service-plan-hold.ts) skip it. Its price, calendar and team are its own. ON DELETE SET NULL: when the original goes, the copy is simply a card.';

-- One call, one transaction: the card row (authored fields only, never what the original EARNED — bookings,
-- reviews, public id, record), its authored children (price brackets, what's included, discounts, add-ons,
-- payment schedule, time slots), and a NEW schedule pool so a booking at the copy's branch never takes the
-- original's date. Halls are NOT copied — a room is a place at the original's branch. Agents are NOT copied —
-- the copy's team is its own (a "Whole branch" holder at the target gets it through the trigger above).
CREATE OR REPLACE FUNCTION public.copy_vendor_service_to_branch(
  p_vendor_profile_id UUID,
  p_source_service_id UUID,
  p_branch_id         UUID,      -- NULL = the main location
  p_price_php         INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s          public.vendor_services%ROWTYPE;
  v_new_id   UUID := gen_random_uuid();
  v_pool_id  UUID;
  v_capacity INTEGER;
  v_label    TEXT;
  v_start    INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids('admin')) THEN
    RAISE EXCEPTION 'Only an admin of this shop can copy its cards.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_price_php IS NULL OR p_price_php <= 0 OR p_price_php > 100000000 THEN
    RAISE EXCEPTION 'Set the price there before you copy.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO s FROM public.vendor_services
   WHERE vendor_service_id = p_source_service_id AND vendor_profile_id = p_vendor_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF s.branch_id IS NOT DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'That card is already at this branch.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT branch_label INTO v_label FROM public.vendor_branches
     WHERE branch_id = p_branch_id AND parent_vendor_profile_id = p_vendor_profile_id AND cancelled_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That branch is not one of yours.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_label := 'Main';
  END IF;

  -- "Price there" is the card's headline number on its own basis; the "from ₱X" anchor follows it the same way
  -- parsePricingFields (services/actions.ts) computes it.
  v_start := CASE COALESCE(s.pricing_basis, 'fixed')
               WHEN 'per_pax'  THEN p_price_php * COALESCE(NULLIF(s.min_pax, 0), 1)
               ELSE p_price_php
             END;

  PERFORM set_config('setnayan.branch_copy', 'on', true);
  INSERT INTO public.vendor_services (
    vendor_service_id, vendor_profile_id, category, title, branch_id, branch_copy_of, is_active,
    starting_price_php, per_pax_price_php, hour_base_php,
    crew_size, crew_meal_required, crew_meal_included, transport_included, transport_flat_fee_php,
    package_inclusions, primary_photo_r2_key, showcase_video_r2_key, showcase_photo_r2_keys,
    last_minute_end_months, last_minute_surcharge_pct, daily_capacity, is_linked_only,
    added_pax_price_php, added_pax_block, recommended_lead_time_months, exclusive_perk_text,
    is_demo, demo_batch_id, base_pax, coverage_id, pricing_basis, min_pax, min_hours, extra_hour_php,
    includes_setnayan_gift, gift_pack_code, category_request_id
  ) VALUES (
    v_new_id, s.vendor_profile_id, s.category, s.title, p_branch_id, s.vendor_service_id, s.is_active,
    v_start,
    CASE WHEN s.pricing_basis = 'per_pax'  THEN p_price_php ELSE s.per_pax_price_php END,
    CASE WHEN s.pricing_basis = 'per_hour' THEN p_price_php ELSE s.hour_base_php END,
    s.crew_size, s.crew_meal_required, s.crew_meal_included, s.transport_included, s.transport_flat_fee_php,
    s.package_inclusions, s.primary_photo_r2_key, s.showcase_video_r2_key, s.showcase_photo_r2_keys,
    s.last_minute_end_months, s.last_minute_surcharge_pct, s.daily_capacity, s.is_linked_only,
    s.added_pax_price_php, s.added_pax_block, s.recommended_lead_time_months, s.exclusive_perk_text,
    s.is_demo, s.demo_batch_id, s.base_pax, s.coverage_id, s.pricing_basis, s.min_pax, s.min_hours, s.extra_hour_php,
    s.includes_setnayan_gift, s.gift_pack_code, s.category_request_id
  );

  PERFORM set_config('setnayan.branch_copy', '', true);

  INSERT INTO public.vendor_service_price_brackets (vendor_service_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order)
  SELECT v_new_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order
    FROM public.vendor_service_price_brackets WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
  SELECT v_new_id, vendor_profile_id, label, worth_php, sort_order
    FROM public.vendor_service_inclusions WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_discounts (vendor_service_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order, min_lead_months)
  SELECT v_new_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order, min_lead_months
    FROM public.vendor_service_discounts WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_addons (vendor_service_id, vendor_profile_id, label, from_price_php, sort_order)
  SELECT v_new_id, vendor_profile_id, label, from_price_php, sort_order
    FROM public.vendor_service_addons WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_payment_schedules (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit)
  SELECT v_new_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit
    FROM public.vendor_service_payment_schedules WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_time_slots (vendor_service_id, vendor_profile_id, slot_label, start_time, end_time, slot_capacity, display_order, is_active, seat_capacity)
  SELECT v_new_id, vendor_profile_id, slot_label, start_time, end_time, slot_capacity, display_order, is_active, seat_capacity
    FROM public.vendor_service_time_slots WHERE vendor_service_id = s.vendor_service_id;

  -- Its own calendar: a new vendor-named pool, as many a day as the original's calendar allows.
  SELECT p.daily_booking_capacity INTO v_capacity
    FROM public.vendor_schedule_calendar_services c
    JOIN public.vendor_schedule_pools p ON p.pool_id = c.pool_id
   WHERE c.vendor_service_id = s.vendor_service_id;
  INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, calendar_name, daily_booking_capacity, is_vendor_created)
  VALUES (
    s.vendor_profile_id,
    left(COALESCE(NULLIF(btrim(s.title), ''), s.category) || ' · ' || v_label, 80),
    left(COALESCE(NULLIF(btrim(s.title), ''), s.category) || ' · ' || v_label, 80),
    LEAST(GREATEST(COALESCE(v_capacity, 1), 1), 50),
    TRUE
  )
  RETURNING pool_id INTO v_pool_id;
  INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id)
  VALUES (v_new_id, v_pool_id, s.vendor_profile_id);

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) IS
  'Copy to another branch (owner 2026-11-14, item 10). Admin of the shop only. Copies the card''s AUTHORED fields and children, references the same photos, sets branch_copy_of (so it uses no card), gives it its own price and its own schedule pool. Never copies bookings, reviews, halls, agents or the public id.';
