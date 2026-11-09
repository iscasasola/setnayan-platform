-- coordinators_post_private_lines_reach_their_one_reader_and_money_masks
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE B · ROUND 3 — owner FINAL RULINGS 2026-11-09 (03-FINAL-RULINGS):
--
-- §1 · COORDINATORS POST LIKE HOSTS. "Coordinators/planners ARE chat members" —
--      they read every thread of their event (current_thread_ids(), migration
--      20271330575424) and now WRITE there too: tg_chat_messages_derive_sender
--      gets the 'coordinator' branch that 20271330575424's header said was
--      missing. The INSERT policy already admits them (current_thread_ids()),
--      so nothing is widened; the trigger was the only thing refusing. They
--      still cannot leave (chat_thread_leave is hosts-only) and still cannot
--      read a private line between two other people (the RESTRICTIVE policy
--      chat_messages_private_reaches_two is untouched).
--
-- §2 · "ONLY THE RECIPIENT IS NOTIFIED." A private line now tells its ONE
--      reader, in-app: an AFTER INSERT trigger writes one `chat_message`
--      notification to recipient_user_id and nobody else. The text of the line
--      is NOT copied into the notice (it says who and where, never what), and
--      the push webhook stays shared-lines-only (20271329968207), so no email,
--      push or allowlist path changes.
--
-- §3 · ₱ MASKING EVERYWHERE, THE STREAM INCLUDED. A coordinator without
--      Budget & payments (= no couple membership, no 'budget' delegate area,
--      not the shop) reads "₱ — hosts only" for every amount. Done SERVER-SIDE:
--        • chat_money_hidden(event, shop) — SECURITY DEFINER predicate, the
--          SQL twin of lib/budget-visibility.ts for this one question;
--        • chat_mask_pesos(text) / chat_mask_money_json(jsonb) — the masks;
--        • four SECURITY INVOKER readers the chat stream reads through when the
--          server says the reader is masked — messages, quotes, amendments,
--          amendment items. INVOKER on purpose: each runs under the caller's
--          OWN RLS, so no row becomes visible that was not before (RLS is not
--          widened); the reader only removes amounts from what RLS returns.
--      ⚠ What this does NOT do (flagged in the PR, not decided here): the
--      underlying tables stay readable through their existing policies, and a
--      realtime INSERT payload still carries the raw row. Closing those needs a
--      column-level narrowing of RLS or a broadcast-only realtime — an owner /
--      infrastructure call, not a migration this lane should make silently.
--
-- §4 · THE BLOCKER HOLD COUNTS EVERY BLOCKER. chat_blocker_shown() already
--      takes 'change_approval'; the app now derives that blocker server-side
--      with a stable key ('adjustment:<amendment_id>'), so its shows count per
--      person per blocker like the others. No schema change; db-tested.
--
-- NOT APPLIED ANYWHERE. The pipeline applies it after merge.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 · a coordinator speaks as 'coordinator' ──────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_derive_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_role public.chat_sender_role;
BEGIN
  -- Service role, the table owner and migrations author 'system' rows, bot
  -- replies and demo seeds with an explicit sender. They are the server; there
  -- is nothing to derive them from and nothing to protect them against.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'chat_messages: no signed-in identity to attribute this message to'
      USING ERRCODE = '42501';
  END IF;

  SELECT CASE
    -- A couple member of the event.
    WHEN NEW.event_id IN (SELECT public.current_couple_event_ids())
      THEN 'couple'::public.chat_sender_role
    -- The vendor profile's owner, or an owner/admin team member.
    WHEN NEW.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      THEN 'vendor'::public.chat_sender_role
    -- Vendor-side staff below admin, on an event their assigned service serves.
    WHEN NEW.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
     AND NEW.event_id IN (SELECT public.agent_customer_event_ids())
      THEN 'vendor'::public.chat_sender_role
    -- 🆕 A coordinator / planner of THIS event, in THIS thread (owner 2026-11-09:
    -- "Coordinators/planners ARE chat members and post like hosts").
    WHEN NEW.thread_id IN (SELECT public.current_thread_ids())
     AND EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = NEW.event_id
                    AND em.user_id = v_uid
                    AND em.member_type = 'coordinator')
      THEN 'coordinator'::public.chat_sender_role
    ELSE NULL
  END INTO v_role;

  IF v_role IS NULL THEN
    RAISE EXCEPTION
      'chat_messages: sender is not a party to this conversation'
      USING ERRCODE = '42501';
  END IF;

  NEW.sender_role    := v_role;
  NEW.sender_user_id := v_uid;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.tg_chat_messages_derive_sender() IS
  'BEFORE INSERT on chat_messages: for end-user sessions, replaces any client-supplied sender_role/sender_user_id with values derived from auth.uid() — couple, vendor (owner/admin team, or assigned staff), or coordinator (an event_members coordinator of the event, in the thread; migration 20271333348826). Service-role and owner sessions pass through untouched.';

-- ── §2 · a private line tells its one reader ────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_private_tells_its_reader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
  v_shop_side BOOLEAN;
  v_url TEXT;
BEGIN
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Who it is from, in the words the recipient knows them by.
  IF NEW.sender_role = 'vendor' THEN
    SELECT vp.business_name INTO v_from FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  ELSE
    SELECT NULLIF(btrim(COALESCE(u.display_name, u.first_name, '')), '') INTO v_from
      FROM public.users u WHERE u.user_id = NEW.sender_user_id;
  END IF;
  -- Which side the recipient reads from: the shop's own messages, or the event's.
  v_shop_side := EXISTS (SELECT 1 FROM public.vendor_profiles vp
                          WHERE vp.vendor_profile_id = NEW.vendor_profile_id
                            AND vp.user_id = NEW.recipient_user_id)
              OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                          WHERE tm.vendor_profile_id = NEW.vendor_profile_id
                            AND tm.user_id = NEW.recipient_user_id
                            AND tm.deactivated_at IS NULL);
  v_url := CASE WHEN v_shop_side
                THEN '/vendor-dashboard/messages/' || NEW.thread_id::TEXT
                ELSE '/dashboard/' || NEW.event_id::TEXT || '/messages/' || NEW.thread_id::TEXT END;

  -- ONE row, to the recipient. The words of the line are NOT copied here: the
  -- notice says who and where; the line itself stays behind the two-person policy.
  INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
  VALUES (
    NEW.recipient_user_id,
    'chat_message'::public.notification_type,
    left(format('Private message from %s', COALESCE(v_from, 'someone in your chat')), 160),
    'Only you can read it. Open the chat to see it.',
    v_url,
    NEW.event_id
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_private_tells_its_reader() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.tg_chat_messages_private_tells_its_reader() IS
  'AFTER INSERT on chat_messages, private rows only: one in-app chat_message notification to recipient_user_id and nobody else (owner 2026-11-09 "Only the recipient is notified"). Never copies the body. Migration 20271333348826.';

DROP TRIGGER IF EXISTS chat_messages_private_tells_its_reader ON public.chat_messages;
CREATE TRIGGER chat_messages_private_tells_its_reader
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.recipient_user_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_chat_messages_private_tells_its_reader();

-- ── §3 · ₱ masking ──────────────────────────────────────────────────────────
-- Is every amount in this conversation hidden from the caller? TRUE only for a
-- coordinator of the event who is not a host, not the shop, not an admin, and
-- holds no 'budget' delegate area. Everyone else (and anyone we cannot place) →
-- FALSE: the readers then return exactly what RLS returns.
CREATE OR REPLACE FUNCTION public.chat_money_hidden(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = p_event_id AND em.user_id = auth.uid()
                    AND em.member_type = 'coordinator')
     AND NOT EXISTS (SELECT 1 FROM public.event_members em
                      WHERE em.event_id = p_event_id AND em.user_id = auth.uid()
                        AND em.member_type = 'couple')
     AND (p_vendor_profile_id IS NULL
          OR (p_vendor_profile_id NOT IN (SELECT public.current_vendor_profile_ids())
              AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids())))
     AND public.moderator_area_level(p_event_id, 'budget') IS NULL
     AND NOT COALESCE(public.is_admin(), FALSE);
$$;
REVOKE ALL ON FUNCTION public.chat_money_hidden(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_money_hidden(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_money_hidden(UUID, UUID) IS
  'TRUE when the caller is a coordinator of the event without Budget & payments (no couple membership, no budget delegate area, not the shop, not admin) — every amount they read in the chat is "₱ — hosts only" (owner 2026-11-09). The SQL twin of lib/budget-visibility.ts for this question. Migration 20271333348826.';

-- Every peso figure in a sentence → "₱ — hosts only".
CREATE OR REPLACE FUNCTION public.chat_mask_pesos(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           regexp_replace(p_text, '₱\s?-?[0-9][0-9,]*(\.[0-9]+)?', '₱ — hosts only', 'g'),
           '\mPHP\s?-?[0-9][0-9,]*(\.[0-9]+)?', '₱ — hosts only', 'gi');
$$;
REVOKE ALL ON FUNCTION public.chat_mask_pesos(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_mask_pesos(TEXT) TO authenticated;

-- Every money-named key → null, at any depth; every string → its pesos masked.
CREATE OR REPLACE FUNCTION public.chat_mask_money_json(p_value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  ELSIF jsonb_typeof(p_value) = 'object' THEN
    RETURN (
      SELECT COALESCE(jsonb_object_agg(
               k,
               CASE WHEN k ~* '(centavos|_php$|^php|price|amount|total|deposit|fee|balance|cost|discount|subtotal)'
                     AND jsonb_typeof(v) IN ('number', 'string')
                    THEN 'null'::jsonb
                    ELSE public.chat_mask_money_json(v) END), '{}'::jsonb)
        FROM jsonb_each(p_value) AS e(k, v));
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    RETURN (
      SELECT COALESCE(jsonb_agg(public.chat_mask_money_json(x) ORDER BY i), '[]'::jsonb)
        FROM jsonb_array_elements(p_value) WITH ORDINALITY AS a(x, i));
  ELSIF jsonb_typeof(p_value) = 'string' THEN
    RETURN to_jsonb(public.chat_mask_pesos(p_value #>> '{}'));
  END IF;
  RETURN p_value;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_mask_money_json(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_mask_money_json(JSONB) TO authenticated;

-- The thread's messages, under the caller's own RLS; bodies masked when hidden.
CREATE OR REPLACE FUNCTION public.chat_thread_messages_read(p_thread_id UUID)
RETURNS SETOF public.chat_messages
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.chat_messages;
  v_hide BOOLEAN := FALSE;
BEGIN
  SELECT public.chat_money_hidden(t.event_id, t.vendor_profile_id) INTO v_hide
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  FOR r IN SELECT * FROM public.chat_messages m WHERE m.thread_id = p_thread_id ORDER BY m.created_at LOOP
    IF COALESCE(v_hide, FALSE) THEN
      r.body := public.chat_mask_pesos(r.body);
    END IF;
    RETURN NEXT r;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_thread_messages_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_messages_read(UUID) TO authenticated;

-- One conversation's quotes (the event × shop pair), under the caller's RLS; amounts nulled when hidden.
CREATE OR REPLACE FUNCTION public.chat_quotes_read(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS SETOF public.vendor_proposals
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.vendor_proposals;
  v_hide BOOLEAN := public.chat_money_hidden(p_event_id, p_vendor_profile_id);
BEGIN
  FOR r IN SELECT * FROM public.vendor_proposals p
            WHERE p.event_id = p_event_id AND p.vendor_profile_id = p_vendor_profile_id
            ORDER BY p.created_at LOOP
    IF v_hide THEN
      r := jsonb_populate_record(NULL::public.vendor_proposals, public.chat_mask_money_json(to_jsonb(r)));
    END IF;
    RETURN NEXT r;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_quotes_read(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_quotes_read(UUID, UUID) TO authenticated;

-- A conversation's amendments and their lines, under the caller's RLS; amounts nulled when hidden.
CREATE OR REPLACE FUNCTION public.chat_amendments_read(p_amendment_ids UUID[])
RETURNS SETOF public.proposal_amendments
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.proposal_amendments;
BEGIN
  FOR r IN SELECT * FROM public.proposal_amendments a WHERE a.amendment_id = ANY (p_amendment_ids) LOOP
    IF public.chat_money_hidden(r.event_id, r.vendor_profile_id) THEN
      r := jsonb_populate_record(NULL::public.proposal_amendments, public.chat_mask_money_json(to_jsonb(r)));
    END IF;
    RETURN NEXT r;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_amendments_read(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_amendments_read(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_amendment_items_read(p_amendment_ids UUID[])
RETURNS SETOF public.proposal_amendment_items
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.proposal_amendment_items;
BEGIN
  FOR r IN SELECT * FROM public.proposal_amendment_items i
            WHERE i.amendment_id = ANY (p_amendment_ids) ORDER BY i.sort_order LOOP
    IF public.chat_money_hidden(r.event_id, r.vendor_profile_id) THEN
      r := jsonb_populate_record(NULL::public.proposal_amendment_items, public.chat_mask_money_json(to_jsonb(r)));
    END IF;
    RETURN NEXT r;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_amendment_items_read(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_amendment_items_read(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.chat_thread_messages_read(UUID) IS
  'The chat stream''s message read for a masked reader: the thread''s rows under the CALLER''S OWN RLS (SECURITY INVOKER — nothing widened), every peso figure in a body → "₱ — hosts only" when chat_money_hidden(). Migration 20271333348826.';
COMMENT ON FUNCTION public.chat_quotes_read(UUID, UUID) IS
  'The chat stream''s quote read (one event × shop) for a masked reader: caller''s RLS, money-named fields nulled when chat_money_hidden(). Migration 20271333348826.';
COMMENT ON FUNCTION public.chat_amendments_read(UUID[]) IS
  'The chat stream''s amendment read for a masked reader: caller''s RLS, money nulled / pesos masked when chat_money_hidden(). Migration 20271333348826.';
COMMENT ON FUNCTION public.chat_amendment_items_read(UUID[]) IS
  'The chat stream''s amendment-line read for a masked reader: caller''s RLS, amount_php nulled when chat_money_hidden(). Migration 20271333348826.';

COMMIT;
