-- verified_shops_shortlist_qr_and_the_event_free_slot
--
-- Owner rulings of 2026-11-16 on top of d4899cd5 / 9fe95ebe (migration 20271350679653), specs DECISION_LOG:
--   · 34909f12 + 99b6ab50 — every QR is an import QR, but the import waivers (the free year, the first-supplier free
--     booking) apply only to a VERIFIED shop, and only to imports made after it was verified. Every booking an
--     UNVERIFIED shop gets pays the flat 5% fee — QR, import or found.
--   · 993cdb9 (1) — clients imported under the retired "free for life" rule keep the waiver on bookings ALREADY MADE:
--     booking_fee_ledger.attribution is frozen at the lock and never rewritten (its ON CONFLICT updates the amount,
--     not the attribution), so nothing here touches them.
--   · 993cdb9 (2) — when the first imported supplier on an event cancels or is removed, the event's free slot is USED
--     UP. Rows are hard-deleted on removal, so the slot is recorded once, when the first import lands, in
--     booking_fee_event_import_slots, and outlives the row.
--   · 1abf35b (1) — the supplier's Shortlist QR (vendor_shortlist_qr) is an import QR under the first-supplier rule
--     (supersedes "the Shortlist QR stays free but is not an import", 16 Nov). It leaves the Setnayan-save lists and
--     joins the supplier-brought ones.
--   · 1abf35b (2) — the couple's own invite from Suppliers > Find (vendor_invites): if claiming it CREATED the shop
--     (the shop was made after the invite was sent), that shop's booking is fee-free; if the shop already existed, it
--     pays the normal fee.
-- Photo QR stays a Setnayan surface (unchanged).
--
-- ORDER, AND WHY: (0) unverified -> fee. (1) the free year. (4) a Setnayan fact on this event. HOLE 3 (the same
-- couple sourced earlier). (1abf35b-2) the couple's Find invite. (2)(3) the event's one free import slot. Else free
-- (found outside Setnayan, verified shop).
-- "Verified since" = the newest APPROVED initial or post-demotion verification (an annual renewal does not restart
-- it), else last_verified_at. A demoted-then-reverified shop's imports made while demoted therefore pay.
--
-- Adds one table (+ its trigger and a backfill of existing imports) and functions. RLS: the table is service-role
-- only (RLS on, no policy). No other data is written; no frozen ledger row is changed.

-- ── 1 · the event's one free import slot, kept after the row is gone ──
CREATE TABLE IF NOT EXISTS public.booking_fee_event_import_slots (
  event_id          UUID PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  imported_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.booking_fee_event_import_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_fee_event_import_slots FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_fee_event_import_slots FROM anon;
REVOKE ALL ON TABLE public.booking_fee_event_import_slots FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.booking_fee_event_import_slots TO service_role;
COMMENT ON TABLE public.booking_fee_event_import_slots IS
  'The ONE free imported-supplier slot of each event (owner 2026-11-16 d4899cd5 (2)(3), 9fe95ebe, 993cdb9 (2)): the first '
  'shop whose supplier-brought event_vendors row landed on the event. Written once by a trigger, never updated, and kept '
  'when that row is removed - a cancelled first supplier still uses the slot. Read by booking_fee_is_first_import.';

CREATE OR REPLACE FUNCTION public.booking_fee_take_import_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $slot$
BEGIN
  IF NEW.marketplace_vendor_id IS NOT NULL
     AND NEW.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')
     AND (TG_OP = 'INSERT' OR OLD.source IS DISTINCT FROM NEW.source) THEN
    INSERT INTO public.booking_fee_event_import_slots (event_id, vendor_profile_id, imported_at)
    VALUES (NEW.event_id, NEW.marketplace_vendor_id, COALESCE(NEW.created_at, NOW()))
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$slot$;
REVOKE ALL ON FUNCTION public.booking_fee_take_import_slot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_take_import_slot() FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_take_import_slot() FROM authenticated;
COMMENT ON FUNCTION public.booking_fee_take_import_slot() IS
  'AFTER INSERT OR UPDATE OF source on event_vendors: the first supplier-brought row on an event takes the event''s one '
  'free import slot (booking_fee_event_import_slots). First committed wins; never moved.';

DROP TRIGGER IF EXISTS event_vendors_take_import_slot ON public.event_vendors;
CREATE TRIGGER event_vendors_take_import_slot
  AFTER INSERT OR UPDATE OF source ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_take_import_slot();

-- Backfill: the earliest supplier-brought row already on each event (lower shop id on a same-instant tie).
INSERT INTO public.booking_fee_event_import_slots (event_id, vendor_profile_id, imported_at)
SELECT DISTINCT ON (ev.event_id) ev.event_id, ev.marketplace_vendor_id, ev.created_at
  FROM public.event_vendors ev
 WHERE ev.marketplace_vendor_id IS NOT NULL
   AND ev.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')
 ORDER BY ev.event_id, ev.created_at, ev.marketplace_vendor_id::text
ON CONFLICT (event_id) DO NOTHING;

-- ── 2 · the per-event rule: the Shortlist QR is supplier-brought now ──
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for_event(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
        FROM public.chat_threads t
       WHERE t.event_id = p_event_id
         AND t.vendor_profile_id = p_vendor_profile_id
         AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    ) THEN 'sourced'
    WHEN EXISTS (
      SELECT 1
        FROM public.event_vendors ev
        LEFT JOIN public.event_manual_vendors emv
          ON emv.manual_vendor_id = ev.manual_vendor_id
       WHERE ev.event_id = p_event_id
         AND (ev.marketplace_vendor_id = p_vendor_profile_id
              OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
         AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')
         AND (
           ev.source IN ('host_marketplace_search', 'auto_cascade_from_finalize')
           OR EXISTS (
             SELECT 1
               FROM public.event_vendors p
              WHERE p.event_id = p_event_id
                AND p.marketplace_vendor_id = p_vendor_profile_id
                AND p.vendor_id <> ev.vendor_id
                AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize')
                AND p.created_at < COALESCE(emv.created_at, ev.created_at)
           )
           OR EXISTS (
             SELECT 1
               FROM public.vendor_profile_views v
              WHERE v.event_id = p_event_id
                AND v.vendor_profile_id = p_vendor_profile_id
                AND v.viewed_at < COALESCE(emv.created_at, ev.created_at)
                AND public.booking_fee_is_sourced_surface(v.source)
           )
         )
    ) THEN 'sourced'
    WHEN EXISTS (
      -- (4) A row the supplier brought, preceded by a Setnayan save of the shop or a Setnayan profile view for this event.
      SELECT 1
        FROM public.event_vendors ev
       WHERE ev.event_id = p_event_id
         AND ev.marketplace_vendor_id = p_vendor_profile_id
         AND ev.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')
         AND (
           EXISTS (
             SELECT 1
               FROM public.event_vendors p
              WHERE p.event_id = p_event_id
                AND p.marketplace_vendor_id = p_vendor_profile_id
                AND p.vendor_id <> ev.vendor_id
                AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize')
                AND p.created_at < ev.created_at
           )
           OR EXISTS (
             SELECT 1
               FROM public.vendor_profile_views v
              WHERE v.event_id = p_event_id
                AND v.vendor_profile_id = p_vendor_profile_id
                AND v.viewed_at < ev.created_at
                AND public.booking_fee_is_sourced_surface(v.source)
           )
         )
    ) THEN 'sourced'
    ELSE 'import'
  END;
$$;

CREATE OR REPLACE FUNCTION public.booking_fee_import_at(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT min(ev.created_at)
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = p_vendor_profile_id
     AND ev.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr');
$$;

-- ── 3 · (2)/(3): the slot holder is the first imported supplier ──
CREATE OR REPLACE FUNCTION public.booking_fee_is_first_import(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_fee_event_import_slots s
     WHERE s.event_id = p_event_id
       AND s.vendor_profile_id = p_vendor_profile_id
  );
$$;
COMMENT ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) IS
  'True when this shop holds the event''s one free import slot (booking_fee_event_import_slots) - the first imported '
  'supplier on the event, kept even if its row was later removed (993cdb9 (2)).';

-- ── 4 · since when the shop has been verified (NULL = not verified now) ──
CREATE OR REPLACE FUNCTION public.booking_fee_shop_verified_since(p_vendor_profile_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN vp.verification_state = 'verified' THEN
           COALESCE(
             (SELECT max(a.decided_at)
                FROM public.vendor_verification_applications a
               WHERE a.vendor_profile_id = vp.vendor_profile_id
                 AND a.status = 'approved'
                 AND a.application_type IN ('initial', 'post_demotion')),
             vp.last_verified_at,
             '-infinity'::timestamptz)
         END
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id;
$$;
COMMENT ON FUNCTION public.booking_fee_shop_verified_since(UUID) IS
  'NULL when the shop is not verified now; else the start of its current verification (newest approved initial or '
  'post-demotion application, else last_verified_at). Import waivers apply only to imports made at or after it (99b6ab50).';

-- ── 5 · the couple's own invite from Suppliers > Find: did claiming it create this shop? ──
CREATE OR REPLACE FUNCTION public.booking_fee_couple_invite_shop(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN bool_or(vp.created_at >= i.sent_at) THEN 'new'
           WHEN count(*) > 0 THEN 'existing'
         END
    FROM public.vendor_invites i
    JOIN public.event_vendors ev ON ev.vendor_id = i.vendor_id
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = i.claimed_vendor_profile_id
   WHERE i.status = 'claimed'
     AND i.claimed_vendor_profile_id = p_vendor_profile_id
     AND ev.event_id = p_event_id;
$$;
COMMENT ON FUNCTION public.booking_fee_couple_invite_shop(UUID, UUID) IS
  'Returns new when the couple''s own Suppliers > Find invite on this event was claimed by a shop created after the '
  'invite was sent (claiming it made the shop), existing when an already-existing shop claimed it, NULL otherwise (1abf35b (2)).';

-- ── 6 · the bill's "introduced on" date: a Shortlist QR row is no longer a Setnayan save ──
CREATE OR REPLACE FUNCTION public.booking_fee_introduced_on(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rec AS (
    SELECT emv.created_at AS rec_at
      FROM public.event_vendors ev
      JOIN public.event_manual_vendors emv
        ON emv.manual_vendor_id = ev.manual_vendor_id
     WHERE ev.event_id = p_event_id
       AND (ev.marketplace_vendor_id = p_vendor_profile_id
            OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
       AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')
  ),
  facts AS (
    SELECT t.created_at AS at
      FROM public.chat_threads t
     WHERE t.event_id = p_event_id
       AND t.vendor_profile_id = p_vendor_profile_id
       AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    UNION ALL
    SELECT p.created_at
      FROM public.event_vendors p
     WHERE p.event_id = p_event_id
       AND p.marketplace_vendor_id = p_vendor_profile_id
       AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize')
    UNION ALL
    SELECT v.viewed_at
      FROM public.vendor_profile_views v
     WHERE v.event_id = p_event_id
       AND v.vendor_profile_id = p_vendor_profile_id
       AND public.booking_fee_is_sourced_surface(v.source)
  )
  SELECT (min(f.at) AT TIME ZONE 'Asia/Manila')::date
    FROM facts f
   WHERE f.at < (SELECT max(r.rec_at) FROM rec r);
$$;

-- (body unchanged from 20271350679653; restated so this file reads whole)
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
    FROM (SELECT public.booking_fee_import_at(p_vendor_profile_id, p_event_id) AS at) a;
$$;

-- ── 7 · the rule every caller reads ──
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
    -- 1abf35b (2): the couple's own Find invite. A shop it created books free; an existing shop pays.
    WHEN public.booking_fee_couple_invite_shop(p_vendor_profile_id, p_event_id) = 'new' THEN 'import'
    WHEN public.booking_fee_couple_invite_shop(p_vendor_profile_id, p_event_id) = 'existing' THEN 'sourced'
    -- (2)/(3) The supplier brought this booking: free only for the event's one free import slot, imported after the
    -- shop was verified. Every other supplier on the event pays.
    WHEN public.booking_fee_import_at(p_vendor_profile_id, p_event_id) IS NOT NULL THEN
      CASE WHEN public.booking_fee_is_first_import(p_vendor_profile_id, p_event_id)
                AND public.booking_fee_import_at(p_vendor_profile_id, p_event_id) >= (SELECT since FROM vs)
           THEN 'import' ELSE 'sourced' END
    -- Nothing from Setnayan and nothing imported, verified shop: found outside Setnayan (unchanged).
    ELSE 'import'
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). Owner 2026-11-16: (0) an unverified shop always pays (99b6ab50); (1) a '
  'verified shop whose import brought the client onto Setnayan books that client free for 12 months (d4899cd5); (4) a '
  'Setnayan fact on the event makes it sourced; HOLE 3 - the same couple sourced earlier is sourced here; the couple''s '
  'own Find invite is free only when it created the shop (1abf35b); (2)(3) a supplier-brought booking - every QR incl. '
  'the Shortlist QR - is free only for the event''s one free import slot, imported after verification (9fe95ebe, '
  '993cdb9); found outside Setnayan stays free. Bookings already made keep the attribution frozen in booking_fee_ledger.';

REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_at(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_shop_verified_since(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_shop_verified_since(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_shop_verified_since(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_shop_verified_since(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_couple_invite_shop(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_couple_invite_shop(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_couple_invite_shop(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_couple_invite_shop(UUID, UUID) TO service_role;
