-- a_claimed_shop_carries_the_couples_record
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION +
-- REVOKE/GRANT only. No table, no column, no policy.
--
-- ── WHY (owner 2026-10-19, "have you tested an account and shop creation
--    step?" → "can't you test it first?") ──────────────────────────────────────
-- The couple adds their supplier by hand (Suppliers → Add your own), shares the
-- link, and the supplier signs up from it: `/vendor/claim/<token>` →
-- `/signup?as=vendor&next=…/finalize` → the finalize page. Nobody had walked it
-- end to end. Walked in SQL (apps/web/tests/db/
-- a-supplier-joins-from-the-couples-link.db.test.ts), the shop came out
-- NAMELESS AND WITH NO SERVICE:
--
--   1. `/signup?as=vendor` posts `account_type = 'vendor'`, so
--      `handle_new_auth_user` writes `public.users.account_type = 'vendor'`, and
--      `on_users_vendor_created` → `handle_new_vendor_user()` (20270401574089)
--      at once inserts an EMPTY shop — `INSERT INTO vendor_profiles (user_id)`,
--      no name, `services = '{}'` — plus its admin seat.
--   2. The finalize page then looked for "the signed-in user's shop", FOUND that
--      empty row, and took its "already has a shop" branch — which writes
--      nothing. The branch that copies the couple's record onto the shop
--      (`business_name` + `services = [category]`) only ran when NO shop
--      existed, which after a vendor sign-up is never.
--
-- So every supplier who joined through a couple's link arrived with a shop
-- called nothing, in no category.
--
-- ── THE FIX: ONE CALL THAT READIES THE SHOP ──────────────────────────────────
-- `claim_ready_the_shop(user, token)` is the finalize page's step 1, in SQL, so
-- the db test exercises the very statement the page runs:
--   · finds the user's shop, or opens one (a sign-up that arrives as
--     'customer' — Google, or an existing couple account — has none);
--   · FILLS ONLY BLANKS from the couple's record: the name when it has none,
--     the service when it has none. A shop that already has a name and a
--     service (an existing supplier connecting a new couple) is untouched;
--   · makes sure the shop has its admin seat — the free unlock that seats the
--     couple as a customer checks the caller is an answering member, and a
--     shop opened here had none;
--   · refuses a link that is not pending (the page already branches on that;
--     this is the boundary behind it).
-- The service written is the couple's own `service_category` — exactly what
-- the finalize page's create branch has written since 2026-05. Nothing new is
-- invented here.
--
-- Service role only: the page calls it on the admin client after proving the
-- session user.

CREATE OR REPLACE FUNCTION public.claim_ready_the_shop(p_user_id uuid, p_claim_token text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status   text;
  v_name     text;
  v_email    text;
  v_category text;
  v_services text[];
  v_shop     uuid;
BEGIN
  IF p_user_id IS NULL OR p_claim_token IS NULL OR length(p_claim_token) = 0 THEN
    RAISE EXCEPTION 'claim_ready_the_shop: a user and a claim token are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT status::text, NULLIF(btrim(business_name), ''), email, NULLIF(btrim(service_category), '')
    INTO v_status, v_name, v_email, v_category
    FROM public.vendor_invites
   WHERE claim_token = p_claim_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_ready_the_shop: no such link' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'claim_ready_the_shop: this link is %', v_status USING ERRCODE = '55000';
  END IF;

  v_services := CASE WHEN v_category IS NULL THEN ARRAY[]::text[] ELSE ARRAY[v_category] END;

  SELECT vendor_profile_id INTO v_shop FROM public.vendor_profiles WHERE user_id = p_user_id;

  IF v_shop IS NULL THEN
    INSERT INTO public.vendor_profiles (user_id, business_name, contact_email, services, is_published)
    VALUES (p_user_id, v_name, v_email, v_services, FALSE)
    RETURNING vendor_profile_id INTO v_shop;
  ELSE
    -- Blanks only. A name or a service the supplier already set is theirs.
    UPDATE public.vendor_profiles
       SET business_name = COALESCE(NULLIF(btrim(business_name), ''), v_name),
           services      = CASE WHEN COALESCE(cardinality(services), 0) = 0 THEN v_services ELSE services END,
           contact_email = COALESCE(contact_email, v_email),
           updated_at    = NOW()
     WHERE vendor_profile_id = v_shop
       AND (
         (NULLIF(btrim(business_name), '') IS NULL AND v_name IS NOT NULL)
         OR (COALESCE(cardinality(services), 0) = 0 AND v_category IS NOT NULL)
         OR (contact_email IS NULL AND v_email IS NOT NULL)
       );
  END IF;

  INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
  VALUES (v_shop, p_user_id, 'admin')
  ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;

  RETURN v_shop;
END;
$$;

COMMENT ON FUNCTION public.claim_ready_the_shop(uuid, text) IS
  'Finalize step 1 of a supplier joining from a couple''s link: find or open the '
  'user''s shop, fill ONLY its blank name and service from the couple''s record, '
  'and make sure it has its admin seat. Refuses a link that is not pending. '
  'Service role only (the finalize page, after proving the session user).';

REVOKE ALL ON FUNCTION public.claim_ready_the_shop(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_the_shop(uuid, text) TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2 · THE COORDINATOR TRADE HAS THREE NAMES — ONE ANSWER (2026-10-19)
-- ═══════════════════════════════════════════════════════════════════════════
-- Found on the same walk. Every coordinator gate in SQL asked
-- `'coordinator' = ANY (vp.services)` — the TILE key. No shop writer puts it
-- there: /open-shop writes the coarse category first and the canonical leaf
-- second (['planner_coordinator', 'wedding_coordination']), and a couple's
-- claim link writes the couple's category (['planner_coordinator']). So the
-- day-of requests inbox, "only the coordinator advances", and find-my-seat were
-- closed to every real coordinator — the db tests seeded the tile and passed.
--
-- `services_make_a_coordinator(services)` is the one answer: the tile, the
-- coarse category, and every canonical leaf under the coordinator tile. It is
-- the SQL copy of `COORDINATOR_TRADE_SERVICES` (apps/web/lib/coordinator-trade.ts);
-- `coordinator-trade-is-one-list.test.ts` fails if the two lists differ or
-- drift from the taxonomy.
--
-- The two functions that carried the predicate are re-created from their
-- LATEST bodies (20271013100000 · 20271254054934) with that one line changed.
-- `advance_programme_block` already reads `current_coordinator_booked_event_ids()`
-- (20271227867922), so it follows without being touched.

CREATE OR REPLACE FUNCTION public.services_make_a_coordinator(p_services text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT COALESCE(p_services, ARRAY[]::text[]) && ARRAY[
    'coordinator',
    'planner_coordinator',
    'wedding_coordination',
    'wedding_planner_partial',
    'day_of_coordinator',
    'destination_wedding_specialist',
    'pamamanhikan_coordinator',
    'despedida_planner',
    'sponsor_coordinator',
    'gender_separated_reception_coordinator',
    'religious_venue_coordinator',
    'inc_wedding_coordinator',
    'mahr_coordination',
    'setnayan_concierge'
  ]::text[];
$$;

COMMENT ON FUNCTION public.services_make_a_coordinator(text[]) IS
  'Is this services[] the coordinator trade, under any of its names (tile, coarse '
  'category, canonical leaves)? SQL copy of COORDINATOR_TRADE_SERVICES '
  '(apps/web/lib/coordinator-trade.ts); a unit test holds the two equal.';

-- Called only from SECURITY DEFINER gates (they run as the owner), so no
-- browser principal needs it: no widening of the exposure surface.
REVOKE ALL ON FUNCTION public.services_make_a_coordinator(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.services_make_a_coordinator(text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.current_coordinator_booked_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ev.event_id
  FROM public.event_vendors ev
  JOIN public.vendor_profiles vp
    ON vp.vendor_profile_id = ev.marketplace_vendor_id
  WHERE ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    AND public.services_make_a_coordinator(vp.services)
    AND (
      vp.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_team_members tm
        WHERE tm.vendor_profile_id = vp.vendor_profile_id
          AND tm.user_id = auth.uid()
      )
    );
$$;
COMMENT ON FUNCTION public.current_coordinator_booked_event_ids() IS
  'Events where the caller is the BOOKED COORDINATOR (a vendor whose services are the coordinator trade under any name — services_make_a_coordinator). The day-of requests inbox is theirs to triage, and they are not an event member, so current_event_ids() does not reach them.';
REVOKE ALL ON FUNCTION public.current_coordinator_booked_event_ids()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_coordinator_booked_event_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.coordinator_seat_by_guest_qr(
  p_event_id UUID,
  p_token    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
  v_is_coordinator BOOLEAN;
  v_guest_id UUID;
  v_table_label TEXT;
BEGIN
  -- A token is 32 lowercase hex chars (encode(gen_random_bytes(16),'hex')).
  -- Reject anything else before touching a table.
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  -- 1 · a vendor identity
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  -- 2 + 3 · booked on THIS event, carrying the coordinator tile
  SELECT EXISTS (
    SELECT 1
    FROM public.event_vendors ev
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids)
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND public.services_make_a_coordinator(vp.services)
  ) INTO v_is_coordinator;
  IF NOT v_is_coordinator THEN
    RAISE EXCEPTION 'not_the_coordinator' USING ERRCODE = '42501';
  END IF;

  -- 4 · THE HOST MUST HAVE SHARED THE SEAT PLAN. This is the owner's rule
  --     (2026-07-27) that booking alone grants nothing: the host picks which
  --     areas a coordinator gets, and revoking the area closes this function
  --     immediately. 'view' suffices — this call never writes.
  IF public.moderator_area_level(p_event_id, 'seat_plan') IS NULL THEN
    RAISE EXCEPTION 'seat_plan_not_shared' USING ERRCODE = '42501';
  END IF;

  -- 5 · guests may see their seats (seats_show_on_the_day): the event's day,
  --     or earlier by the couple's show-early switch — the ONE seat rule.
  IF NOT public.guests_may_see_seats(p_event_id) THEN
    RAISE EXCEPTION 'not_published' USING ERRCODE = 'P0002';
  END IF;

  -- The guest must belong to THIS event. A card from another wedding resolves
  -- to nothing here, which is what makes 'not_this_event' honest.
  SELECT g.guest_id INTO v_guest_id
  FROM public.guests g
  WHERE g.qr_token = p_token
    AND g.event_id = p_event_id
    AND g.deleted_at IS NULL;

  IF v_guest_id IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  SELECT et.table_label INTO v_table_label
  FROM public.event_seat_assignments a
  JOIN public.event_tables et ON et.table_id = a.table_id
  WHERE a.event_id = p_event_id AND a.guest_id = v_guest_id;

  -- found=TRUE with a NULL label = on the list, no seat on the published plan.
  RETURN jsonb_build_object('found', TRUE, 'table_label', v_table_label);
END $$;

COMMENT ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT) IS
  'Find-my-seat for the floor coordinator: given a guest QR token they are physically holding, return that ONE guest''s table label and nothing else — no name, no guest id, no neighbours. Gated on booked + the coordinator trade (services_make_a_coordinator) + the seat rule (public.guests_may_see_seats: the event day, or the couple''s show-early switch). Adds no table, column or policy: a booked vendor still cannot read guests, seat assignments or tables directly (get_vendor_seat_plan gives them counts, never people).';

REVOKE ALL ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT) TO authenticated;
