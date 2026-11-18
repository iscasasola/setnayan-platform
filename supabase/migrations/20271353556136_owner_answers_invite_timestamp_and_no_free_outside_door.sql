-- owner_answers_invite_timestamp_and_no_free_outside_door
--
-- The owner's answers of 2026-11-16 to the #7841 questions (specs DECISION_LOG, logged by the controller):
--   Q1 · "The import created the account" uses the INVITE TIMESTAMP: an import whose invite was issued before the
--        client's account existed made that account. Where the import has a per-couple invite record — the Locked QR
--        token (`vendor_locked_qr_tokens.created_at`, claimed onto the event) or, once Add a client (#7889) lands, its
--        `vendor_client_invites.created_at` (claimed onto the event) — every couple member's account must have been
--        created at or after it. Static QRs (the Shortlist QR, the own link, prints) carry no per-couple invite, so the
--        structural reading stays their only test (the client's first event, and the import is the first thing on it).
--   Q2 · a Find invite that creates a new, unverified shop stays free — already so (20271352968519).
--   Q3 · close the coordinator loophole on the outside door too: a booking with nothing imported pays. The last arm of
--        `booking_fee_attribution_for` is now 'sourced', not 'import'. What is free is exactly: the free year, the
--        couple's Find invite that created the shop, and the event's one free import slot.
--   Q5 · imports made during a demotion gap pay — already so (20271352968519, "verified since").
--   34909f1 / 1abf35b (1) · the shop's own link is an import QR: a chat through it (inquiry_source 'website') dates the
--        import and takes the event's free slot (trigger on chat_threads + a backfill of empty slots).
-- Functions, one trigger and a backfill of empty slots. No other data is written.

-- ── The shop's OWN LINK is an import QR too (34909f1 / 1abf35b (1)) ──────────────────────────────────────────
-- A couple who arrives through the shop's own link / QR (`?src=own`) opens a chat whose inquiry_source is 'website'
-- (`arrivalInquirySourceOf`) — there is no supplier-brought event_vendors row. With answer 3 closing the outside door,
-- that thread must count as the import itself: it dates the import and takes the event's free slot.
CREATE OR REPLACE FUNCTION public.booking_fee_import_at(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT LEAST(
    (SELECT min(ev.created_at)
       FROM public.event_vendors ev
      WHERE ev.event_id = p_event_id
        AND ev.marketplace_vendor_id = p_vendor_profile_id
        AND ev.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')),
    (SELECT min(t.created_at)
       FROM public.chat_threads t
      WHERE t.event_id = p_event_id
        AND t.vendor_profile_id = p_vendor_profile_id
        AND t.inquiry_source = 'website')
  );
$$;
COMMENT ON FUNCTION public.booking_fee_import_at(UUID, UUID) IS
  'The moment a supplier imported the client onto an event: the earliest supplier-brought row (vendor_invite, '
  'vendor_locked_qr, reuse_accept, vendor_shortlist_qr) or the earliest chat through the shop''s own link '
  '(inquiry_source website). NULL when the supplier did not import them onto it.';

CREATE OR REPLACE FUNCTION public.booking_fee_take_import_slot_from_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $slot$
BEGIN
  IF NEW.event_id IS NOT NULL AND NEW.vendor_profile_id IS NOT NULL AND NEW.inquiry_source = 'website' THEN
    INSERT INTO public.booking_fee_event_import_slots (event_id, vendor_profile_id, imported_at)
    VALUES (NEW.event_id, NEW.vendor_profile_id, COALESCE(NEW.created_at, NOW()))
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$slot$;
REVOKE ALL ON FUNCTION public.booking_fee_take_import_slot_from_thread() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_take_import_slot_from_thread() FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_take_import_slot_from_thread() FROM authenticated;
COMMENT ON FUNCTION public.booking_fee_take_import_slot_from_thread() IS
  'AFTER INSERT on chat_threads: a chat through the shop''s own link (inquiry_source website) is an import and takes '
  'the event''s one free import slot if nobody holds it yet.';
DROP TRIGGER IF EXISTS chat_threads_take_import_slot ON public.chat_threads;
CREATE TRIGGER chat_threads_take_import_slot
  AFTER INSERT ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_take_import_slot_from_thread();

-- Backfill own-link chats into empty slots, earliest first (supplier-brought rows were backfilled in 20271352968519).
INSERT INTO public.booking_fee_event_import_slots (event_id, vendor_profile_id, imported_at)
SELECT DISTINCT ON (t.event_id) t.event_id, t.vendor_profile_id, t.created_at
  FROM public.chat_threads t
 WHERE t.event_id IS NOT NULL AND t.vendor_profile_id IS NOT NULL AND t.inquiry_source = 'website'
 ORDER BY t.event_id, t.created_at, t.vendor_profile_id::text
ON CONFLICT (event_id) DO NOTHING;

-- …and where an own-link chat came BEFORE the supplier-brought row the previous file backfilled into the slot, the chat
-- was the first import, exactly as the live triggers would have ruled (first committed wins). Backfilled slots only:
-- this runs in the same deploy as the slot table's own creation, so every slot it can see is a backfill or seconds
-- old. No frozen ledger row is touched (Opus money review, 2026-11-18).
UPDATE public.booking_fee_event_import_slots s
   SET vendor_profile_id = w.vendor_profile_id,
       imported_at       = w.created_at
  FROM (
    SELECT DISTINCT ON (t.event_id) t.event_id, t.vendor_profile_id, t.created_at
      FROM public.chat_threads t
     WHERE t.event_id IS NOT NULL AND t.vendor_profile_id IS NOT NULL AND t.inquiry_source = 'website'
     ORDER BY t.event_id, t.created_at, t.vendor_profile_id::text
  ) w
 WHERE w.event_id = s.event_id
   AND w.created_at < s.imported_at;

CREATE OR REPLACE FUNCTION public.booking_fee_import_invite_at(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_at TIMESTAMPTZ;
  v_ci TIMESTAMPTZ;
BEGIN
  SELECT min(t.created_at) INTO v_at
    FROM public.vendor_locked_qr_tokens t
   WHERE t.vendor_profile_id = p_vendor_profile_id
     AND t.claimed_event_id = p_event_id;
  -- Add a client's invite (#7889) — read only once that table exists, so this file applies before or after it.
  IF to_regclass('public.vendor_client_invites') IS NOT NULL THEN
    EXECUTE 'SELECT min(created_at) FROM public.vendor_client_invites WHERE vendor_profile_id = $1 AND claimed_event_id = $2'
      INTO v_ci USING p_vendor_profile_id, p_event_id;
  END IF;
  RETURN LEAST(v_at, v_ci);
END;
$fn$;
COMMENT ON FUNCTION public.booking_fee_import_invite_at(UUID, UUID) IS
  'When the per-couple invite behind this supplier''s import onto the event was issued: the Locked QR token, or Add a '
  'client''s invite once that table exists. NULL for a static QR (Shortlist QR, own link, prints). Owner 2026-11-16 Q1.';

CREATE OR REPLACE FUNCTION public.booking_fee_import_created_account(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.event_members m
        WHERE m.event_id = p_event_id AND m.member_type = 'couple'
     )
     -- Q1: with a per-couple invite, no couple member's account is older than the invite.
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_members m
         JOIN auth.users u ON u.id = m.user_id
        WHERE m.event_id = p_event_id
          AND m.member_type = 'couple'
          AND a.invite_at IS NOT NULL
          AND u.created_at < a.invite_at
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_members m
         JOIN public.event_members mo
           ON mo.user_id = m.user_id
          AND mo.member_type = 'couple'
          AND mo.event_id <> p_event_id
         JOIN public.events oe ON oe.event_id = mo.event_id
         JOIN public.events e ON e.event_id = p_event_id
        WHERE m.event_id = p_event_id
          AND m.member_type = 'couple'
          AND oe.created_at <= e.created_at
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.event_vendors x
        WHERE x.event_id = p_event_id AND x.created_at < a.at
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_threads t
        WHERE t.event_id = p_event_id AND t.created_at < a.at
     )
    FROM (SELECT public.booking_fee_import_at(p_vendor_profile_id, p_event_id) AS at,
                 public.booking_fee_import_invite_at(p_vendor_profile_id, p_event_id) AS invite_at) a;
$$;
COMMENT ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) IS
  'True when this supplier''s import onto the event brought the client onto Setnayan: no couple member''s account is '
  'older than the import''s per-couple invite (owner Q1, when there is one), the event is the first of every couple '
  'member, and the import is the first shop row and precedes every chat on it. Fails toward the fee.';

-- Q3 · the rule every caller reads: the last arm pays.
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH vs AS (
    SELECT public.booking_fee_shop_verified_since(p_vendor_profile_id) AS since
  ),
  couple_events AS (
    SELECT DISTINCT mo.event_id
      FROM public.event_members me
      JOIN public.event_members mo
        ON mo.user_id = me.user_id
       AND mo.member_type = 'couple'
     WHERE me.event_id = p_event_id
       AND me.member_type = 'couple'
  )
  SELECT CASE
    -- No booking with this shop on the event (no marketplace row, no linked row, no record matched to it) and no chat
    -- started from a Setnayan surface:
    -- there is nothing to bill, so nothing is attributed — answer 3 charges bookings, not the absence of one.
    WHEN NOT EXISTS (
      SELECT 1
        FROM public.event_vendors ev
        LEFT JOIN public.event_manual_vendors emv ON emv.manual_vendor_id = ev.manual_vendor_id
       WHERE ev.event_id = p_event_id
         AND (ev.marketplace_vendor_id = p_vendor_profile_id
              OR ev.linked_vendor_profile_id = p_vendor_profile_id
              OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
    ) AND NOT EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.event_id = p_event_id AND t.vendor_profile_id = p_vendor_profile_id
         AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    ) THEN 'import'
    -- 1abf35b (2), FIRST: the couple's own Find invite that CREATED the shop books free. Such a shop is unverified by
    -- construction, so this must run before the unverified gate below (the later, more specific ruling).
    WHEN public.booking_fee_couple_invite_shop(p_vendor_profile_id, p_event_id) = 'new' THEN 'import'
    -- (0) 99b6ab50: every booking an unverified shop gets pays the flat 5% fee.
    WHEN (SELECT since FROM vs) IS NULL THEN 'sourced'
    -- (1) The import brought the client onto Setnayan, after the shop was verified, within the last 12 months, with no
    --     Setnayan fact first: free with this shop on every event of that client.
    WHEN EXISTS (
      SELECT 1
        FROM couple_events ce
       WHERE public.booking_fee_import_created_account(p_vendor_profile_id, ce.event_id)
         AND public.booking_fee_import_at(p_vendor_profile_id, ce.event_id) > NOW() - INTERVAL '12 months'
         AND public.booking_fee_import_at(p_vendor_profile_id, ce.event_id) >= (SELECT since FROM vs)
         AND public.booking_fee_attribution_for_event(p_vendor_profile_id, ce.event_id) = 'import'
    ) THEN 'import'
    -- (4) A Setnayan fact on this event.
    WHEN public.booking_fee_attribution_for_event(p_vendor_profile_id, p_event_id) = 'sourced' THEN 'sourced'
    -- HOLE 3 (LOCKED §3, every repeat of a SOURCED CLIENT): the same couple, found for this shop BY SETNAYAN on an
    -- event first touched no later. Read from that event's Setnayan facts only (booking_fee_attribution_for_event),
    -- never its frozen ledger stamp: since these rulings a 'sourced' stamp also means "an unverified shop" (99b6ab50) or
    -- "nothing imported" (answer 3) — a booking that paid, not a client Setnayan found — and carrying it would bill the
    -- couple's next event even where the shop is that event's free first import (Opus money review, 2026-11-18).
    WHEN EXISTS (
      SELECT 1
        FROM public.event_members me
        JOIN public.event_members mo
          ON mo.user_id = me.user_id
         AND mo.member_type = 'couple'
         AND mo.event_id <> p_event_id
       WHERE me.event_id = p_event_id
         AND me.member_type = 'couple'
         AND public.booking_fee_first_contact_at(p_vendor_profile_id, mo.event_id)
               <= COALESCE(public.booking_fee_first_contact_at(p_vendor_profile_id, p_event_id), 'infinity'::timestamptz)
         AND public.booking_fee_attribution_for_event(p_vendor_profile_id, mo.event_id) = 'sourced'
    ) THEN 'sourced'
    -- 1abf35b (2): the couple's own Find invite claimed by a shop that already existed pays the normal fee.
    WHEN public.booking_fee_couple_invite_shop(p_vendor_profile_id, p_event_id) = 'existing' THEN 'sourced'
    -- (2)/(3) The supplier brought this booking: free only for the event's one free import slot, imported after the
    -- shop was verified. Every other supplier on the event pays.
    WHEN public.booking_fee_import_at(p_vendor_profile_id, p_event_id) IS NOT NULL THEN
      CASE WHEN public.booking_fee_is_first_import(p_vendor_profile_id, p_event_id)
                AND public.booking_fee_import_at(p_vendor_profile_id, p_event_id) >= (SELECT since FROM vs)
           THEN 'import' ELSE 'sourced' END
    -- Owner 2026-11-16 (answer 3, closes the coordinator loophole on this door too): a booking with nothing imported is
    -- not free just because Setnayan recorded no fact — a couple typing in a verified shop a coordinator named pays.
    ELSE 'sourced'
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). FREE (import) only in three cases, owner 2026-11-16: the couple''s own Find '
  'invite created the shop (1abf35b); a verified shop''s import brought the client onto Setnayan, within 12 months '
  '(d4899cd5, invite timestamp Q1); the event''s one free import slot, imported after verification (9fe95ebe, 993cdb9). '
  'Everything else is sourced: an unverified shop (99b6ab50), a Setnayan fact, the same couple found by Setnayan earlier '
  '(HOLE 3 - that event''s Setnayan facts, never its frozen stamp), '
  'an existing shop claiming the couple''s invite, a later import, and a booking with nothing imported (Q3). Bookings '
  'already made keep the attribution frozen in booking_fee_ledger.';

REVOKE ALL ON FUNCTION public.booking_fee_import_invite_at(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_invite_at(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_invite_at(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_invite_at(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_at(UUID, UUID) TO service_role;
