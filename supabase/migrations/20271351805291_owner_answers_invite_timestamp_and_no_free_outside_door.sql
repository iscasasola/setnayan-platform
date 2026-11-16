-- owner_answers_invite_timestamp_and_no_free_outside_door
--
-- The owner's answers of 2026-11-16 to the #7841 questions (specs DECISION_LOG, logged by the controller):
--   Q1 · "The import created the account" uses the INVITE TIMESTAMP: an import whose invite was issued before the
--        client's account existed made that account. Where the import has a per-couple invite record — the Locked QR
--        token (`vendor_locked_qr_tokens.created_at`, claimed onto the event) or, once Add a client (#7889) lands, its
--        `vendor_client_invites.created_at` (claimed onto the event) — every couple member's account must have been
--        created at or after it. Static QRs (the Shortlist QR, the own link, prints) carry no per-couple invite, so the
--        structural reading stays their only test (the client's first event, and the import is the first thing on it).
--   Q2 · a Find invite that creates a new, unverified shop stays free — already so (20271351371342).
--   Q3 · close the coordinator loophole on the outside door too: a booking with nothing imported pays. The last arm of
--        `booking_fee_attribution_for` is now 'sourced', not 'import'. What is free is exactly: the free year, the
--        couple's Find invite that created the shop, and the event's one free import slot.
--   Q5 · imports made during a demotion gap pay — already so (20271351371342, "verified since").
-- Functions only. No data is written.

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
    -- No booking with this shop on the event at all (no marketplace row, no linked row, no record matched to it):
    -- there is nothing to bill, so nothing is attributed — answer 3 charges bookings, not the absence of one.
    WHEN NOT EXISTS (
      SELECT 1
        FROM public.event_vendors ev
        LEFT JOIN public.event_manual_vendors emv ON emv.manual_vendor_id = ev.manual_vendor_id
       WHERE ev.event_id = p_event_id
         AND (ev.marketplace_vendor_id = p_vendor_profile_id
              OR ev.linked_vendor_profile_id = p_vendor_profile_id
              OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
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
    -- HOLE 3 (LOCKED §3, every repeat): the same couple, sourced to this shop on an event first touched no later.
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
         AND COALESCE(
               (SELECT l.attribution
                  FROM public.booking_fee_ledger l
                 WHERE l.vendor_profile_id = p_vendor_profile_id
                   AND l.event_id = mo.event_id
                   AND l.attribution_frozen_at IS NOT NULL),
               public.booking_fee_attribution_for_event(p_vendor_profile_id, mo.event_id)
             ) = 'sourced'
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
  'Everything else is sourced: an unverified shop (99b6ab50), a Setnayan fact, the same couple sourced earlier (HOLE 3), '
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
