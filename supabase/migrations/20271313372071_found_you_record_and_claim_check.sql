-- found_you_record_and_claim_check
-- Created via `pnpm migration:new`. Idempotent: it may be re-applied.
-- ============================================================================
-- 🕵️ FOUND-YOU — THE RECORD OF WHEN A COUPLE FIRST SAW A SHOP HERE, AND THE
-- CHECK THAT READS IT WHEN THAT SHOP CLAIMS THE COUPLE'S LINK.
--
-- Owner, 2026-11-05 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS", item 2), verbatim:
--   "we already had this plan which logs users that has seen or shown in the app
--    as a result. and it saves the date when you first saw that supplier. yes
--    this is important"
-- The plan is DECISION_LOG 2026-07-27 (four 🕵️ FOUND-YOU rows) and
-- `Explore_Replan_BUILD_SPEC_2026-07-27.md` §10:
--   · ONE row per (event × shop): `first_found_at`, `view_count`,
--     `last_viewed_at`, where it was first seen. No search queries, no
--     impressions, no per-view trail, no dwell — "the receipt that makes the
--     found rule enforceable, nothing more".
--   · "found" = the couple OPENED the shop (its page, or its sheet in Find) from
--     a Setnayan surface. "If they were just part of the searches and the card
--     was not opened… they are still not found."
--   · Counted UNTIL the shop is on the event, frozen after.
--   · CLAIM-SYNC is the authoritative check: a shop with NO account claims FREE,
--     always; a shop with an ACTIVE account the couple had already viewed
--     (`view_count > 0`, `first_found_at` BEFORE the couple's own record) is
--     FOUND.
--
-- Five changes, nothing else:
--   1 · public.event_vendor_found — the record. Couple-only reads (behavioural
--       data, the most-protected class: §10 "couple-scoped RLS, no cross-event
--       reuse"); nobody writes it but the trigger and the claim check.
--   2 · found_you_note_view() on vendor_profile_views — the record is written AT
--       THE MOMENT OF SEEING, by the view row the app ALREADY writes
--       (`recordVendorProfileView`, fire-and-forget in Next `after()`). It counts
--       only what fee rule B already counts: a view for an event, from a
--       Setnayan surface (`booking_fee_is_sourced_surface` — Explore, search /
--       Find, shortlist, favourites, editorial …). A view through the shop's own
--       link (`profile_direct`, `website`, none) is the SHOP showing the couple,
--       not Setnayan, and writes nothing (owner 2026-10-12).
--       WRITE COST: per qualifying view, ONE primary-key upsert plus ONE probe of
--       the existing (event_id, marketplace_vendor_id) index, inside the insert
--       the app already sends — zero extra round trips, zero reads on the page.
--       Lists, rails, scrolling and search results write NOTHING (they never
--       wrote a view row, and still do not).
--   3 · found_you_check_at_claim() — the check itself.
--   4 · answer_claim_access_request() calls it right after the bond, in its own
--       savepoint, and returns its answer as `found_you`. The function body is
--       the shipped one (20271280900282) with that ONE block added.
--   5 · vendor_source_attribution() counts a FOUND claim as 'setnayan' on the
--       supplier's My Performance page — without rewriting event_vendors.source
--       (the 2026-08-09 rule in 20271121904105: a booking's history is never
--       overwritten). Body is the shipped one (20271221806689) + one WHEN.
--
-- 💸 MONEY: NOTHING HERE CHANGES WHAT IS CHARGED. `booking_fee_attribution_for`
-- is untouched — it already answers 'sourced' for a claimed record of a shop the
-- couple viewed from a Setnayan surface before typing the record (its
-- view arm, 20271267252894), which is the same fact this record keeps. The db
-- test `found-you-at-claim.db.test.ts` holds the two to the same answer. No flag
-- and no price is read or written.
--
-- BACKFILL: from vendor_profile_views — the recorded views, the same facts the
-- trigger reads, counted only up to the shop's first row on the event. Not a
-- guess: a row exists only where a view row exists.
-- ============================================================================

BEGIN;

-- ── 1 · The record ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vendor_found (
  event_id          UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID        NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  first_found_at    TIMESTAMPTZ NOT NULL,
  first_source      TEXT        NOT NULL,
  last_viewed_at    TIMESTAMPTZ NOT NULL,
  view_count        INTEGER     NOT NULL DEFAULT 1 CHECK (view_count >= 1),
  found_at_claim_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, vendor_profile_id)
);
ALTER TABLE public.event_vendor_found ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_vendor_found IS
  'FOUND-YOU (DECISION_LOG 2026-07-27; built 2026-11-05): one row per (event, shop) - when this couple first opened the '
  'shop from a Setnayan surface, how many times until the shop joined the event, and whether the claim check found '
  'them. Written only by found_you_note_view (a trigger on vendor_profile_views) and found_you_check_at_claim. '
  'Couple-only reads. Behavioural data: DPO review on /admin/data-privacy.';
COMMENT ON COLUMN public.event_vendor_found.first_found_at IS
  'The first time the couple opened this shop from a Setnayan surface for this event. Never moves later.';
COMMENT ON COLUMN public.event_vendor_found.view_count IS
  'Opens from a Setnayan surface, counted until the shop has a row on the event, frozen after.';
COMMENT ON COLUMN public.event_vendor_found.found_at_claim_at IS
  'Set when the couple approved this shop''s claim of their own record and found_you_check_at_claim said FOUND: the '
  'shop had an account, and the couple had seen it here before typing the record. NULL = never found at a claim.';

DROP POLICY IF EXISTS event_vendor_found_couple_read ON public.event_vendor_found;
CREATE POLICY event_vendor_found_couple_read
  ON public.event_vendor_found FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_vendor_found_admin_read ON public.event_vendor_found;
CREATE POLICY event_vendor_found_admin_read
  ON public.event_vendor_found FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- The platform's default privileges grant every new table to anon + authenticated; take the writes back
-- explicitly so the policies above are not the only wall.
REVOKE ALL ON public.event_vendor_found FROM PUBLIC;
REVOKE ALL ON public.event_vendor_found FROM anon;
REVOKE ALL ON public.event_vendor_found FROM authenticated;
GRANT SELECT ON public.event_vendor_found TO authenticated;
GRANT ALL ON public.event_vendor_found TO service_role;

-- ── 2 · Written at the moment of seeing ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.found_you_note_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Frozen: the shop is already on this event (a save, a lock, a claimed record). §10: counted UNTIL added.
  IF EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = NEW.event_id
       AND ev.marketplace_vendor_id = NEW.vendor_profile_id
       AND ev.archived_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.event_vendor_found AS f
    (event_id, vendor_profile_id, first_found_at, first_source, last_viewed_at, view_count)
  VALUES
    (NEW.event_id, NEW.vendor_profile_id, NEW.viewed_at, NEW.source, NEW.viewed_at, 1)
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
    SET view_count     = f.view_count + 1,
        last_viewed_at = GREATEST(f.last_viewed_at, EXCLUDED.last_viewed_at),
        first_source   = CASE WHEN EXCLUDED.first_found_at < f.first_found_at THEN EXCLUDED.first_source ELSE f.first_source END,
        first_found_at = LEAST(f.first_found_at, EXCLUDED.first_found_at);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- The view row itself is fee rule B's evidence; a failure here must never drop it.
  RAISE NOTICE 'found_you_note_view: record skipped (%)', SQLERRM;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.found_you_note_view() IS
  'AFTER INSERT on vendor_profile_views: one upsert into event_vendor_found for a view with an event, from a Setnayan '
  'surface (booking_fee_is_sourced_surface), while the shop is not yet on the event. Never raises.';

REVOKE ALL ON FUNCTION public.found_you_note_view() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.found_you_note_view() FROM anon;
REVOKE ALL ON FUNCTION public.found_you_note_view() FROM authenticated;

DROP TRIGGER IF EXISTS found_you_note_view_trg ON public.vendor_profile_views;
CREATE TRIGGER found_you_note_view_trg
  AFTER INSERT ON public.vendor_profile_views
  FOR EACH ROW
  WHEN (NEW.event_id IS NOT NULL AND public.booking_fee_is_sourced_surface(NEW.source))
  EXECUTE FUNCTION public.found_you_note_view();

-- Backfill: the views already recorded, up to the shop's first row on the event.
INSERT INTO public.event_vendor_found
  (event_id, vendor_profile_id, first_found_at, first_source, last_viewed_at, view_count)
SELECT v.event_id,
       v.vendor_profile_id,
       min(v.viewed_at),
       (array_agg(v.source ORDER BY v.viewed_at))[1],
       max(v.viewed_at),
       count(*)::INT
  FROM public.vendor_profile_views v
 WHERE v.event_id IS NOT NULL
   AND public.booking_fee_is_sourced_surface(v.source)
   AND NOT EXISTS (
     SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = v.event_id
        AND ev.marketplace_vendor_id = v.vendor_profile_id
        AND ev.created_at <= v.viewed_at
   )
 GROUP BY v.event_id, v.vendor_profile_id
ON CONFLICT (event_id, vendor_profile_id) DO NOTHING;

-- ── 3 · The check ──────────────────────────────────────────────────────────
-- p_record_vendor_id = the couple's own record (event_vendors row) the shop claimed through.
-- Its moment = the hand-typed card's created_at, else the row's (fee rule B uses the same moment).
CREATE OR REPLACE FUNCTION public.found_you_check_at_claim(
  p_record_vendor_id UUID,
  p_vendor_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_rec_at   TIMESTAMPTZ;
  v_shop_at  TIMESTAMPTZ;
  f          public.event_vendor_found%ROWTYPE;
BEGIN
  SELECT ev.event_id, COALESCE(emv.created_at, ev.created_at)
    INTO v_event_id, v_rec_at
    FROM public.event_vendors ev
    LEFT JOIN public.event_manual_vendors emv ON emv.manual_vendor_id = ev.manual_vendor_id
   WHERE ev.vendor_id = p_record_vendor_id;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('found', FALSE, 'why', 'no_record');
  END IF;

  -- 1 · NO account before the couple's record → FREE, always (owner 2026-07-27: "will automatically sync them
  --     for free if they are not yet member"). A shop made after the record cannot have been seen before it.
  SELECT created_at INTO v_shop_at FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_profile_id;
  IF v_shop_at IS NULL OR v_shop_at >= v_rec_at THEN
    RETURN jsonb_build_object('found', FALSE, 'why', 'new_account');
  END IF;

  -- 2 · An ACTIVE account: found only if the couple opened it here BEFORE typing the record (the §10 timing
  --     guard — a later open never converts an earlier record).
  SELECT * INTO f
    FROM public.event_vendor_found
   WHERE event_id = v_event_id AND vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;
  IF NOT FOUND OR f.view_count <= 0 OR f.first_found_at >= v_rec_at THEN
    RETURN jsonb_build_object('found', FALSE, 'why', 'not_seen_first');
  END IF;

  UPDATE public.event_vendor_found
     SET found_at_claim_at = COALESCE(found_at_claim_at, now())
   WHERE event_id = v_event_id AND vendor_profile_id = p_vendor_profile_id;

  RETURN jsonb_build_object(
    'found', TRUE,
    'first_found_at', f.first_found_at,
    'view_count', f.view_count
  );
END;
$$;

COMMENT ON FUNCTION public.found_you_check_at_claim(UUID, UUID) IS
  'FOUND-YOU claim check (DECISION_LOG 2026-07-27): {found:true, first_found_at, view_count} when the claiming shop '
  'existed before the couple''s record AND the couple had opened it from a Setnayan surface before typing the record; '
  'stamps event_vendor_found.found_at_claim_at. Otherwise {found:false, why}. Runs inside answer_claim_access_request. '
  'Service role only.';

REVOKE ALL ON FUNCTION public.found_you_check_at_claim(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.found_you_check_at_claim(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.found_you_check_at_claim(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.found_you_check_at_claim(UUID, UUID) TO service_role;

-- ── 4 · The couple's Approve runs the check (shipped body + one block) ─────
CREATE OR REPLACE FUNCTION public.answer_claim_access_request(
  p_request_id UUID,
  p_decided_by UUID,
  p_approve BOOLEAN,
  p_coordinator_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         RECORD;
  v_rec         RECORD;
  v_booking     UUID;
  v_booked      BOOLEAN := FALSE;
  v_coordinator BOOLEAN := FALSE;
  v_found       JSONB   := jsonb_build_object('found', FALSE);
BEGIN
  SELECT request_id, event_id, requester_user_id, vendor_profile_id, event_vendor_id, kind, status
    INTO v_req
    FROM public.event_access_requests
   WHERE request_id = p_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_req.kind <> 'claim' THEN
    RAISE EXCEPTION 'answer_claim_access_request: no such ask' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'answer_claim_access_request: already answered' USING ERRCODE = '55000';
  END IF;
  -- The couple answers — not a helper, not a coordinator (who could let
  -- themselves in), not the supplier.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = v_req.event_id AND m.user_id = p_decided_by AND m.member_type = 'couple'
  ) THEN
    RAISE EXCEPTION 'answer_claim_access_request: only the couple answers' USING ERRCODE = '42501';
  END IF;
  -- The ask must be backed by a real claim of THIS record by THIS person and
  -- shop. The couple may UPDATE ask rows under RLS, so the row alone is not
  -- proof of anything.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_invites i
     WHERE i.vendor_id = v_req.event_vendor_id
       AND i.status = 'claimed'
       AND i.claimed_vendor_profile_id = v_req.vendor_profile_id
       AND i.claimed_by_user_id = v_req.requester_user_id
  ) THEN
    RAISE EXCEPTION 'answer_claim_access_request: no claim stands behind this ask' USING ERRCODE = '42501';
  END IF;

  IF NOT p_approve THEN
    UPDATE public.event_access_requests
       SET status = 'answered',
           decisions = jsonb_build_object('access', 'declined'),
           decided_by_user_id = p_decided_by
     WHERE request_id = p_request_id;
    RETURN jsonb_build_object('granted', FALSE);
  END IF;

  SELECT vendor_id, event_id, category::TEXT AS category, status::TEXT AS status,
         marketplace_vendor_id, manual_vendor_id
    INTO v_rec
    FROM public.event_vendors
   WHERE vendor_id = v_req.event_vendor_id
   FOR UPDATE;

  -- a · booked if paid. Hand-added (no shop yet), not booked, and at least one
  -- payment the supplier has not refused → it IS booked. Its own sub-block: a
  -- guard that refuses the status leaves the approval standing (the couple's
  -- screens read Booked from the payment either way — lib/booked-by-payment.ts).
  IF v_rec.marketplace_vendor_id IS NULL
     AND v_rec.status IN ('considering', 'shortlisted')
     AND EXISTS (
       SELECT 1 FROM public.event_vendor_payments p
        WHERE p.vendor_id = v_rec.vendor_id AND p.payment_refused_at IS NULL
     )
  THEN
    BEGIN
      UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = v_rec.vendor_id;
      v_booked := TRUE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'answer_claim_access_request: status stayed % (%)', v_rec.status, SQLERRM;
    END;
  ELSIF v_rec.status IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    v_booked := TRUE;
  END IF;

  -- b · the bond (or the merge onto the shop's existing row).
  v_booking := public.claim_link_record_to_shop(v_rec.vendor_id, v_req.vendor_profile_id);

  -- c · the shipped sibling pass: the couple's other categories for the same
  -- hand-added supplier. Best-effort, as it always was; never after a merge.
  IF v_booking = v_rec.vendor_id AND v_rec.manual_vendor_id IS NOT NULL THEN
    BEGIN
      UPDATE public.event_vendors
         SET marketplace_vendor_id = v_req.vendor_profile_id
       WHERE manual_vendor_id = v_rec.manual_vendor_id
         AND event_id = v_rec.event_id
         AND vendor_id <> v_rec.vendor_id
         AND (marketplace_vendor_id IS NULL OR marketplace_vendor_id = v_req.vendor_profile_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'answer_claim_access_request: siblings stayed unlinked (%)', SQLERRM;
    END;
  END IF;

  -- 🕵️ FOUND-YOU — THE ONE ADDITION (migration 20271313372071; DECISION_LOG 2026-07-27 "CLAIM-SYNC is the
  -- authoritative checkpoint"). The bond above just made identity exact, so this is where the found-check runs:
  -- a shop with an account the couple had already seen here before they typed the record is FOUND; a shop with
  -- no account before the record claims FREE, always. Its own savepoint: a failure here answers "not found"
  -- and can NEVER undo or refuse the couple's Approve — the Saturday supplier invite rides this function.
  BEGIN
    v_found := public.found_you_check_at_claim(v_rec.vendor_id, v_req.vendor_profile_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'answer_claim_access_request: found-check skipped (%)', SQLERRM;
    v_found := jsonb_build_object('found', FALSE);
  END;

  -- d · a coordinator gets the host-level seat (DECISION_LOG 2026-10-07:
  -- "Coordinator Access is Same as User Host… Always auto YES"). A live seat
  -- the couple already shaped keeps its areas.
  IF public.services_make_a_coordinator(ARRAY[v_rec.category]) THEN
    v_coordinator := TRUE;
    INSERT INTO public.event_moderators
      (event_id, user_id, role_subtype, permissions_json, invited_by_user_id, accepted_at)
    VALUES
      (v_rec.event_id, v_req.requester_user_id, 'wedding_planner_external',
       COALESCE(p_coordinator_permissions, '{}'::jsonb), p_decided_by, now())
    ON CONFLICT (event_id, user_id) DO UPDATE
      SET permissions_json = CASE
                               WHEN public.event_moderators.removed_at IS NOT NULL
                                 THEN EXCLUDED.permissions_json
                               ELSE public.event_moderators.permissions_json
                             END,
          role_subtype     = CASE
                               WHEN public.event_moderators.removed_at IS NOT NULL
                                 THEN EXCLUDED.role_subtype
                               ELSE public.event_moderators.role_subtype
                             END,
          accepted_at      = COALESCE(public.event_moderators.accepted_at, now()),
          removed_at       = NULL;
  END IF;

  -- e · the record of what was asked and what was said.
  UPDATE public.event_access_requests
     SET status = 'answered',
         decisions = jsonb_build_object('access', 'granted'),
         decided_by_user_id = p_decided_by,
         event_vendor_id = v_booking
   WHERE request_id = p_request_id;

  RETURN jsonb_build_object(
    'granted', TRUE,
    'booking_vendor_id', v_booking,
    'merged', v_booking <> v_rec.vendor_id,
    'booked', v_booked,
    'coordinator', v_coordinator,
    'found_you', v_found
  );
END;
$$;


COMMENT ON FUNCTION public.answer_claim_access_request(UUID, UUID, BOOLEAN, JSONB) IS
  'The couple''s Approve / Decline on a supplier who joined from their link (owner 2026-10-20). Approve = booked-if-paid '
  'catch-up, the bond/merge (claim_link_record_to_shop), the sibling pass, the FOUND-YOU check '
  '(found_you_check_at_claim, returned as found_you; 2026-11-05), a host-level seat for a coordinator. '
  'Decline writes only the answer. Nothing is granted before this runs. Service role only — the server action proves '
  'the caller is the couple first, and this re-checks it.';

REVOKE ALL ON FUNCTION public.answer_claim_access_request(UUID, UUID, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.answer_claim_access_request(UUID, UUID, BOOLEAN, JSONB) TO service_role;

-- ── 5 · My Performance counts a FOUND claim as Setnayan's (shipped body + one WHEN) ──
CREATE OR REPLACE FUNCTION public.vendor_source_attribution(p_vendor_profile_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(attribution text, booking_count integer, priced_count integer, revenue_php numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Ownership gate — only the vendor's own org (or a console admin) may read.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- IDOR guard — a provided service must belong to this vendor. Defense in
  -- depth: the page only lists the caller's own services, but a spoofed id
  -- must not segment another org's rows through this ownership-gated reader.
  IF p_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_services vs
    WHERE vs.vendor_service_id = p_service_id
      AND vs.vendor_profile_id = p_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: service not owned';
  END IF;

  RETURN QUERY
  WITH booked AS (
    SELECT
      -- Null-safe source classification. Setnayan-attributed = the platform
      -- created the discovery (marketplace search) or the up-sell (cascade).
      -- Everything else the couple/admin brought in themselves = off-platform.
      CASE
        -- 🕵️ FOUND-YOU (20271313372071): a hand-typed record the couple's Approve found to be a shop they had
        -- already seen on Setnayan is Setnayan's — counted here WITHOUT rewriting `ev.source` (the 2026-08-09
        -- rule: a booking's history is never overwritten; the receipt lives on the found-record).
        WHEN EXISTS (
          SELECT 1 FROM public.event_vendor_found f
           WHERE f.event_id = ev.event_id
             AND f.vendor_profile_id = ev.marketplace_vendor_id
             AND f.found_at_claim_at IS NOT NULL
        ) THEN 'setnayan'
        WHEN COALESCE(ev.source, '') IN (
          'host_marketplace_search',
          'auto_cascade_from_finalize'
        ) THEN 'setnayan'
        WHEN COALESCE(ev.source, '') IN (
          'host_manual',
          'admin'
        ) THEN 'off_platform'
        ELSE 'unattributed'
      END AS attribution,
      -- THE ONE CHANGE: the agreed total NOW (lock price + changes since).
      -- NULL stays NULL, so `priced_count` below counts exactly what it did.
      (ev.total_cost_php
         + COALESCE((SELECT SUM(li.amount_php)
                       FROM public.event_vendor_line_items li
                      WHERE li.vendor_id = ev.vendor_id
                        AND li.is_change_delta), 0)) AS total_cost_php
    FROM public.event_vendors ev
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      -- "Booked" = a real commercial commitment (mirrors
      -- BOOKED_EVENT_VENDOR_STATUSES in lib/vendor-funnel.ts, intersected with
      -- the live vendor_status enum: contracted/deposit_paid/delivered/complete).
      AND COALESCE(ev.status::text, '') IN (
        'contracted', 'deposit_paid', 'delivered', 'complete'
      )
      AND (p_since IS NULL OR ev.created_at >= p_since)
      -- Per-service segment (NULL = shop-level, unchanged for 2-arg callers).
      AND (p_service_id IS NULL OR ev.service_id = p_service_id)
  )
  SELECT
    b.attribution,
    COUNT(*)::INTEGER,
    COUNT(b.total_cost_php)::INTEGER,
    COALESCE(SUM(b.total_cost_php), 0)::NUMERIC
  FROM booked b
  GROUP BY b.attribution;
END;
$function$;

-- ── Post-conditions ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.event_vendor_found') IS NULL THEN
    RAISE EXCEPTION 'found_you: public.event_vendor_found is missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_vendor_found'::regclass) THEN
    RAISE EXCEPTION 'found_you: RLS is off on public.event_vendor_found';
  END IF;
  IF has_table_privilege('authenticated', 'public.event_vendor_found', 'INSERT')
     OR has_table_privilege('authenticated', 'public.event_vendor_found', 'UPDATE')
     OR has_table_privilege('anon', 'public.event_vendor_found', 'SELECT') THEN
    RAISE EXCEPTION 'found_you: a browser session can write the found-record, or anon can read it';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'found_you_note_view_trg') THEN
    RAISE EXCEPTION 'found_you: the view trigger is missing';
  END IF;
  IF position('found_you_check_at_claim' IN pg_get_functiondef('public.answer_claim_access_request(uuid,uuid,boolean,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'found_you: answer_claim_access_request does not run the check';
  END IF;
END $$;

COMMIT;
