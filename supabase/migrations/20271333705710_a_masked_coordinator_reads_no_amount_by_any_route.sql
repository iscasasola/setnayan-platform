-- ============================================================================
-- A MASKED COORDINATOR READS NO AMOUNT BY ANY ROUTE — Supplier Build 3 · lane B round 4.
-- Created via `pnpm migration:new`. NOT applied anywhere by this lane — the pipeline pushes it.
--
-- ⚖ FINAL RULINGS 2026-11-09 (owner): a coordinator without Budget & payments reads every amount as
--   "₱ — hosts only", "stripped server-side". Round 3 (20271333348826) masked what the chat SCREEN read through
--   four SECURITY INVOKER readers; the base tables, and realtime, still handed the raw rows to anyone who asked
--   PostgREST directly. This file closes the routes, narrowest first, and widens NOBODY.
--
-- ── THE ROUTES, MEASURED (pg_policies after the full replay; every SELECT policy that admits a coordinator) ──
--   Reached by an event_members coordinator:
--     chat_messages.body ............ current_thread_ids()         [REALTIME]   → §3 money lines hosts-only
--     chat_threads.agreed_price_centavos  current_thread_ids()     [REALTIME]   → §4 column closed
--     chat_decision_topics.title .... current_thread_ids()                      → §3 money titles hosts-only
--     proposal_amendments.note ...... current_event_ids()  (ANY member)         → §3 money notes hosts-only
--     proposal_amendment_items ...... current_event_ids()  (ANY member)         → §3 hosts-only
--   Reached by an event_moderators delegate (a coordinator usually holds one — the default grant is Suppliers
--   edit, Budget OFF — lib/delegate-areas.ts):
--     vendor_proposals .............. current_moderator_event_ids()             → §3 hosts-only
--     vendor_change_orders .......... current_moderator_event_ids()             → §3 hosts-only
--     vendor_payment_asks ........... current_moderator_event_ids()             → §3 hosts-only
--     vendor_reuse_requests ......... current_moderator_event_ids()             → §3 hosts-only
--     event_vendors (price columns) . moderator area 'vendors'                  → NOT closable here (below)
--   Already closed to them: event_vendor_line_items / event_vendor_payments [REALTIME] (budget area only).
--
-- ── THE CLOSURE ──────────────────────────────────────────────────────────────
--   §1 money_hidden_event_ids() — ONE predicate: the events where the caller is a coordinator who is not a host,
--      holds no Budget & payments area and is not an admin. chat_money_hidden() is re-stated on it.
--   §2 money_masked_read() — TRUE only inside the four masking readers, which set a TRANSACTION-LOCAL flag around
--      their own read and clear it before returning. No function takes a setting name from its caller (measured),
--      and PostgREST cannot run SET, so a browser cannot raise the flag.
--   §3 RESTRICTIVE "hosts only" SELECT policies: a row (or a line that names an amount) on a hidden event is
--      withheld from that caller unless it is their own, they are the shop, or the read is a masking reader.
--      RESTRICTIVE can only REMOVE rows — every host, the shop and admins read exactly what they read before.
--      Realtime evaluates the subscriber's RLS, so the same rows stop reaching that coordinator's socket.
--   §4 chat_threads.agreed_price_centavos — no app code reads it on a browser session (it is written on the
--      service role and read by NO code — measured); its SELECT is closed per column for every browser role,
--      so neither a select nor a realtime payload (which carries only the subscriber's selectable columns) holds it.
--
-- 🔑 OWNER, NOT DECIDED HERE: `event_vendors` carries the booking's price columns (total_cost_php,
--   deposit_paid_php, transport_php, …) on the SAME row a Suppliers delegate must read to do the job. RLS is
--   per row, not per column; the column grant is shared by hosts and delegates (one role). Closing it means moving
--   the money columns to their own table, or every host read through a definer reader — a schema change. The
--   couple's supplier page masks every figure it draws from that row for a masked coordinator meanwhile.
-- ============================================================================

-- ── §1 · the one predicate ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.money_hidden_event_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT em.event_id
    FROM public.event_members em
   WHERE em.user_id = auth.uid()
     AND em.member_type = 'coordinator'
     AND NOT EXISTS (SELECT 1 FROM public.event_members c
                      WHERE c.event_id = em.event_id AND c.user_id = auth.uid() AND c.member_type = 'couple')
     AND public.moderator_area_level(em.event_id, 'budget') IS NULL
     AND NOT COALESCE(public.is_admin(), FALSE);
$$;
REVOKE ALL ON FUNCTION public.money_hidden_event_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_hidden_event_ids() TO authenticated;
COMMENT ON FUNCTION public.money_hidden_event_ids() IS
  'The events whose amounts the caller reads as "₱ — hosts only": they are a coordinator there, not a host, hold no Budget & payments delegate area, and are not an admin (owner 2026-11-09). The one predicate behind chat_money_hidden() and the hosts-only SELECT policies. Migration 20271333705710.';

CREATE OR REPLACE FUNCTION public.chat_money_hidden(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_event_id IN (SELECT public.money_hidden_event_ids())
     AND (p_vendor_profile_id IS NULL
          OR (p_vendor_profile_id NOT IN (SELECT public.current_vendor_profile_ids())
              AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids())));
$$;
REVOKE ALL ON FUNCTION public.chat_money_hidden(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_money_hidden(UUID, UUID) TO authenticated;

-- ── §2 · the masking readers' own door ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.money_masked_read()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(current_setting('setnayan.money_masked_read', TRUE), '') = 'on';
$$;
REVOKE ALL ON FUNCTION public.money_masked_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_masked_read() TO authenticated;
COMMENT ON FUNCTION public.money_masked_read() IS
  'TRUE only while one of the four masking readers (chat_thread_messages_read · chat_quotes_read · chat_amendments_read · chat_amendment_items_read) reads its rows — they set a transaction-local flag and clear it before returning. Lets ONLY those readers past the hosts-only policies; what they return is masked. Migration 20271333705710.';

-- Does this text name an amount? The SAME figures chat_mask_pesos() masks.
CREATE OR REPLACE FUNCTION public.chat_text_has_money(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_text ~ '₱\s?-?[0-9]' OR p_text ~* '\mPHP\s?-?[0-9]';
$$;
REVOKE ALL ON FUNCTION public.chat_text_has_money(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_text_has_money(TEXT) TO authenticated;

-- The four readers: unchanged in what they return; now they raise the flag around their own read.
CREATE OR REPLACE FUNCTION public.chat_thread_messages_read(p_thread_id UUID)
RETURNS SETOF public.chat_messages
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.chat_messages;
  v_hide BOOLEAN := FALSE;
BEGIN
  SELECT public.chat_money_hidden(t.event_id, t.vendor_profile_id) INTO v_hide
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  PERFORM set_config('setnayan.money_masked_read', 'on', TRUE);
  FOR r IN SELECT * FROM public.chat_messages m WHERE m.thread_id = p_thread_id ORDER BY m.created_at LOOP
    IF COALESCE(v_hide, FALSE) THEN
      r.body := public.chat_mask_pesos(r.body);
    END IF;
    RETURN NEXT r;
  END LOOP;
  PERFORM set_config('setnayan.money_masked_read', 'off', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_quotes_read(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS SETOF public.vendor_proposals
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.vendor_proposals;
  v_hide BOOLEAN := public.chat_money_hidden(p_event_id, p_vendor_profile_id);
BEGIN
  PERFORM set_config('setnayan.money_masked_read', 'on', TRUE);
  FOR r IN SELECT * FROM public.vendor_proposals p
            WHERE p.event_id = p_event_id AND p.vendor_profile_id = p_vendor_profile_id
            ORDER BY p.created_at LOOP
    IF v_hide THEN
      r := jsonb_populate_record(NULL::public.vendor_proposals, public.chat_mask_money_json(to_jsonb(r)));
    END IF;
    RETURN NEXT r;
  END LOOP;
  PERFORM set_config('setnayan.money_masked_read', 'off', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_amendments_read(p_amendment_ids UUID[])
RETURNS SETOF public.proposal_amendments
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.proposal_amendments;
BEGIN
  PERFORM set_config('setnayan.money_masked_read', 'on', TRUE);
  FOR r IN SELECT * FROM public.proposal_amendments a WHERE a.amendment_id = ANY (p_amendment_ids) LOOP
    IF public.chat_money_hidden(r.event_id, r.vendor_profile_id) THEN
      r := jsonb_populate_record(NULL::public.proposal_amendments, public.chat_mask_money_json(to_jsonb(r)));
    END IF;
    RETURN NEXT r;
  END LOOP;
  PERFORM set_config('setnayan.money_masked_read', 'off', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_amendment_items_read(p_amendment_ids UUID[])
RETURNS SETOF public.proposal_amendment_items
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.proposal_amendment_items;
BEGIN
  PERFORM set_config('setnayan.money_masked_read', 'on', TRUE);
  FOR r IN SELECT * FROM public.proposal_amendment_items i
            WHERE i.amendment_id = ANY (p_amendment_ids) ORDER BY i.sort_order LOOP
    IF public.chat_money_hidden(r.event_id, r.vendor_profile_id) THEN
      r := jsonb_populate_record(NULL::public.proposal_amendment_items, public.chat_mask_money_json(to_jsonb(r)));
    END IF;
    RETURN NEXT r;
  END LOOP;
  PERFORM set_config('setnayan.money_masked_read', 'off', TRUE);
END;
$$;

-- A decision topic's hidden-ness is its thread's.
CREATE OR REPLACE FUNCTION public.chat_thread_money_hidden(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT public.chat_money_hidden(t.event_id, t.vendor_profile_id)
                     FROM public.chat_threads t WHERE t.thread_id = p_thread_id), FALSE);
$$;
REVOKE ALL ON FUNCTION public.chat_thread_money_hidden(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_money_hidden(UUID) TO authenticated;

-- ── §3 · the hosts-only SELECT policies (RESTRICTIVE: they only ever remove rows) ──
-- Every one carries the same three ways through: the event is not hidden from the caller, the caller is the shop
-- (or wrote it), or the read is a masking reader.

DROP POLICY IF EXISTS chat_messages_money_hosts_only ON public.chat_messages;
CREATE POLICY chat_messages_money_hosts_only ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    body IS NULL
    OR NOT public.chat_text_has_money(body)
    OR event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR sender_user_id = (SELECT auth.uid())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.money_masked_read()
  );

DROP POLICY IF EXISTS chat_decision_topics_money_hosts_only ON public.chat_decision_topics;
CREATE POLICY chat_decision_topics_money_hosts_only ON public.chat_decision_topics
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.chat_text_has_money(title)
    OR opened_by_user_id = (SELECT auth.uid())
    OR NOT public.chat_thread_money_hidden(thread_id)
  );

DROP POLICY IF EXISTS proposal_amendments_money_hosts_only ON public.proposal_amendments;
CREATE POLICY proposal_amendments_money_hosts_only ON public.proposal_amendments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    note IS NULL
    OR NOT public.chat_text_has_money(note)
    OR event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR proposed_by_user_id = (SELECT auth.uid())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.money_masked_read()
  );

DROP POLICY IF EXISTS proposal_amendment_items_money_hosts_only ON public.proposal_amendment_items;
CREATE POLICY proposal_amendment_items_money_hosts_only ON public.proposal_amendment_items
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (amount_php IS NULL AND NOT public.chat_text_has_money(label))
    OR event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.money_masked_read()
  );

DROP POLICY IF EXISTS vendor_proposals_money_hosts_only ON public.vendor_proposals;
CREATE POLICY vendor_proposals_money_hosts_only ON public.vendor_proposals
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    event_id IS NULL
    OR event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.money_masked_read()
  );

DROP POLICY IF EXISTS vendor_change_orders_money_hosts_only ON public.vendor_change_orders;
CREATE POLICY vendor_change_orders_money_hosts_only ON public.vendor_change_orders
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    event_id IS NULL
    OR event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
  );

DROP POLICY IF EXISTS vendor_payment_asks_money_hosts_only ON public.vendor_payment_asks;
CREATE POLICY vendor_payment_asks_money_hosts_only ON public.vendor_payment_asks
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    event_id IS NULL
    OR event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
  );

DROP POLICY IF EXISTS vendor_reuse_requests_money_hosts_only ON public.vendor_reuse_requests;
CREATE POLICY vendor_reuse_requests_money_hosts_only ON public.vendor_reuse_requests
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    target_event_id IS NULL
    OR target_event_id NOT IN (SELECT public.money_hidden_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
  );

-- ── §4 · chat_threads.agreed_price_centavos is closed per column ─────────────
-- Every OTHER column keeps exactly the SELECT each browser role held. A column added to chat_threads later is NOT
-- selectable by a browser role until it is granted — held by the round-4 db test, which fails on it.
DO $$
DECLARE
  v_role TEXT;
  v_cols TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.chat_threads', 'SELECT') THEN
      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'chat_threads' AND column_name <> 'agreed_price_centavos';
      EXECUTE format('REVOKE SELECT ON public.chat_threads FROM %I', v_role);
      EXECUTE format('GRANT SELECT (%s) ON public.chat_threads TO %I', v_cols, v_role);
    END IF;
  END LOOP;
  REVOKE SELECT ON public.chat_threads FROM PUBLIC;
  REVOKE SELECT (agreed_price_centavos) ON public.chat_threads FROM PUBLIC, anon, authenticated;

  -- POST-CONDITIONS
  IF has_column_privilege('authenticated', 'public.chat_threads', 'agreed_price_centavos', 'SELECT')
     OR has_column_privilege('anon', 'public.chat_threads', 'agreed_price_centavos', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a browser role can still SELECT chat_threads.agreed_price_centavos';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.chat_threads', 'thread_id', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.chat_threads', 'updated_at', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.chat_threads', 'inquiry_status', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the column close took a column the app reads';
  END IF;
END $$;

COMMENT ON COLUMN public.chat_threads.agreed_price_centavos IS
  'The frozen deal total (written on the service role by lockDeal). No browser role may SELECT it (migration 20271333705710 — a coordinator without Budget & payments must not read it, and no app code read it on a browser session); a realtime payload omits it for the same reason.';
