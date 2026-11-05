-- add_your_own_leak_match_and_link_opened
-- Created via `pnpm migration:new`. Idempotent: it may be re-applied.
-- ============================================================================
-- "ADD YOUR OWN" — THE SHOP A HAND-TYPED RECORD MATCHES, THE OWNER'S PRICE
-- TOLERANCE, THE DAY A COUPLE'S LINK WAS FIRST OPENED, AND FEE RULE B.
--
-- Owner, 2026-10-10 (`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`, answers 1 and 2):
--   1 · "B" — a supplier the couple brings themselves pays the booking fee ONLY
--       IF Setnayan showed the couple that shop first.
--   2 · "10% allowance +-. so if 100,000 that is between 90-110k" — HIS number.
-- Owner, 2026-10-12 (DECISION_LOG): a name match the couple dismissed with
-- "Not them?" does NOT count; couples are NOT told about the fee.
-- Owner, 2026-10-10: the couple IS told when the supplier declines or never
-- opens the link — which needs the link to remember that it was opened.
--
-- Five changes, nothing else:
--   1 · event_manual_vendors.leak_match_vendor_profile_id — the Setnayan shop a
--       hand-typed record matches (its name, or a price within the tolerance of
--       a quote THIS event already received from that shop). Stamped by the
--       server only; a couple's session cannot set or clear it.
--   2 · platform_settings.fee_leak_price_tolerance = 0.10 (a FRACTION, either
--       side: 0.10 → ₱90,000–₱110,000 around ₱100,000).
--   3 · vendor_invites.first_opened_at — stamped once, the first time the claim
--       page is drawn for a pending link (the page already writes on open: it
--       flips a pending link past its date to `expired`).
--   4 · booking_fee_attribution_for reads the three recorded facts (owner
--       2026-10-12, answer 8) — mirrored in apps/web/lib/booking-fee-gate.ts
--       `bookingFeeAttributionFromFacts`; the db test
--       `add-your-own-fee-rule.db.test.ts` holds the two to the same answers.
--   5 · booking_fee_introduced_on — the day Setnayan first showed the couple
--       the shop, for the SUPPLIER'S bill only (answer 11).
--
-- FAIL-SAFE DIRECTION is unchanged (20271009140000): anything unrecognised is an
-- IMPORT (free). Nothing here can make a charge exist where none could before —
-- `booking_fee_open_lock_charge` still skips a row with no
-- `marketplace_vendor_id`, so a record that is only MATCHED (never claimed by
-- that shop) is attributed, never billed.
-- ============================================================================

BEGIN;

-- ── 1 · The shop a hand-typed record matches ───────────────────────────────
ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS leak_match_vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_manual_vendors.leak_match_vendor_profile_id IS
  'The Setnayan shop this hand-typed record matches: its name (not dismissed with "Not them?") or a price within '
  'platform_settings.fee_leak_price_tolerance of a quote this event already received from that shop. NULL = no '
  'match. Server-stamped only (guard_manual_vendor_leak_match). Read by booking_fee_attribution_for (rule B, '
  'owner 2026-10-10). Never shown to the couple.';

CREATE INDEX IF NOT EXISTS event_manual_vendors_leak_match_idx
  ON public.event_manual_vendors (leak_match_vendor_profile_id)
  WHERE leak_match_vendor_profile_id IS NOT NULL;

-- RLS on event_manual_vendors is row-level (event_manual_vendors_host_all), never
-- value-level, so the couple could otherwise write or clear their own stamp. The
-- stamp is held the way guard_thread_provenance_columns (20270820292403) holds a
-- thread's provenance: only the service role, an admin, or a direct connection
-- may set it.
CREATE OR REPLACE FUNCTION public.guard_manual_vendor_leak_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role     TEXT := auth.role();  -- NULL under a direct/superuser connection
  privileged BOOLEAN;
BEGIN
  privileged := (v_role IS NULL)
             OR (v_role = 'service_role')
             OR public.is_admin();
  IF privileged THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.leak_match_vendor_profile_id := NULL;
  ELSE
    NEW.leak_match_vendor_profile_id := OLD.leak_match_vendor_profile_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_manual_vendor_leak_match_trg ON public.event_manual_vendors;
CREATE TRIGGER guard_manual_vendor_leak_match_trg
  BEFORE INSERT OR UPDATE ON public.event_manual_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_manual_vendor_leak_match();

-- ── 2 · The owner's number ─────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS fee_leak_price_tolerance NUMERIC(4, 3) NOT NULL DEFAULT 0.100;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_fee_leak_price_tolerance_check;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_fee_leak_price_tolerance_check
  CHECK (fee_leak_price_tolerance >= 0 AND fee_leak_price_tolerance <= 1);

COMMENT ON COLUMN public.platform_settings.fee_leak_price_tolerance IS
  'How close a hand-typed price must be to a quote this event received for the record to count as that shop''s '
  'booking — a FRACTION either side (0.10 = 10 %: ₱90,000–₱110,000 around ₱100,000). Owner 2026-10-10, verbatim: '
  '"10% allowance +-. so if 100,000 that is between 90-110k". Read by addManualSupplier / updateSelfAddedSupplier.';

-- ── 3 · The day a couple's link was first opened ───────────────────────────
ALTER TABLE public.vendor_invites
  ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_invites.first_opened_at IS
  'The first time the claim page was drawn for this link while it was pending (fetchClaimLandingByToken, service '
  'role, stamped once). NULL = never opened. Lets the couple''s row say "not opened yet" (owner 2026-10-10: the '
  'couple IS told when the supplier never opens the link).';

-- ── 4 · Who showed the couple this shop — the three recorded facts ────────
-- Owner "APPROVE ALL", DECISION_LOG 2026-10-12, answer 8: "Setnayan showed them
-- first" = only facts recorded BEFORE the manual add — a profile view for this
-- event, a save from Find, a chat started from Setnayan; "Not them?" cancels
-- only the name match. Booking-fee audit (controller-2026-10-12/
-- BOOKING_FEE_RULES_AUDIT_2026-10-12.md) build list items 9 and 10: the same
-- three facts for every booking, measured against the booking row's own moment.
--
-- The thread arm is carried over byte-for-byte from 20271009140000 (the only
-- prior definition). The new arm, per booking row R of this (event, shop):
--   · R is tied to the shop — a marketplace row of it, or a couple's hand-typed
--     record the shop CLAIMED (marketplace_vendor_id) or the server MATCHED
--     (leak_match_vendor_profile_id);
--   · R was not brought by the SUPPLIER (their invite, their Locked QR, a reused
--     booking) — never sourced, whatever was seen first;
--   · and one of: R itself is a save from Setnayan (a row stamped
--     host_marketplace_search / auto_cascade_from_finalize — judged by its
--     SOURCE, so a Find save that a claimed record merged onto, and which now
--     carries the record's manual_vendor_id too, still counts) · an EARLIER such
--     save of the same shop on this event · a profile view of the shop for this
--     event FROM A SETNAYAN SURFACE (its `source` is a sourced surface — Explore,
--     search / Find, the shortlist, favourites, editorial …; a view through the
--     supplier's OWN link — `profile_direct`, `website`, or no source — never
--     counts: that is the supplier showing the couple, not Setnayan; owner
--     2026-10-12, "fix the problems") — each strictly before R's moment (a
--     record's own created_at, else the row's).
-- FAIL-SAFE as before: anything else is import.
CREATE INDEX IF NOT EXISTS vendor_profile_views_event_vendor_idx
  ON public.vendor_profile_views (event_id, vendor_profile_id, viewed_at)
  WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for(
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
         AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
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
    ELSE 'import'
  END;
$$;

COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). SOURCED when a chat thread for the pair carries a marketplace-discovery '
  'inquiry_source, OR (owner 2026-10-12 answer 8; rule B 2026-10-10) a booking row tied to the shop - a marketplace '
  'row, or the couple''s hand-typed record claimed by or matched to it - that the supplier did not bring, and that is '
  'itself a save from Setnayan or comes after an earlier save of the shop or a profile view for this event. Fails SAFE '
  'to import. Mirrors bookingFeeAttributionFromFacts + SOURCED_INQUIRY_SOURCES in apps/web/lib/booking-fee-gate.ts.';

-- ── 5 · Why a hand-typed record became billable — for the SUPPLIER'S bill ──
-- Owner "APPROVE ALL" 2026-10-12, answer 11: the supplier is told why a manual
-- add became billable — on their bill only ("Setnayan introduced this couple to
-- you on <date>"); the couple is never told. The date of the EARLIEST recorded
-- fact (a chat started from Setnayan · a save from Find · a profile view for
-- this event) before the couple's own record of this shop. NULL when the pair's
-- booking is not a hand-typed record of the shop, or no such fact came first —
-- the bill then says nothing extra.
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
       AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
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

COMMENT ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) IS
  'The day Setnayan first showed this couple this shop, when their booking is the couple''s hand-typed record of it '
  '(owner 2026-10-12 answer 11: the supplier is told why on their bill only). NULL otherwise. Service role only.';

-- ⚠ REVOKE from anon/authenticated EXPLICITLY (the platform's default privileges
-- grant every new function to both; 20271009140000 explains the trap).
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.guard_manual_vendor_leak_match() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_manual_vendor_leak_match() FROM anon;
REVOKE ALL ON FUNCTION public.guard_manual_vendor_leak_match() FROM authenticated;

-- ── Post-conditions: the four changes are really there ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_manual_vendors'
       AND column_name = 'leak_match_vendor_profile_id'
  ) THEN
    RAISE EXCEPTION 'add_your_own: event_manual_vendors.leak_match_vendor_profile_id is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_settings'
       AND column_name = 'fee_leak_price_tolerance' AND column_default LIKE '0.1%'
  ) THEN
    RAISE EXCEPTION 'add_your_own: platform_settings.fee_leak_price_tolerance is missing or not defaulted to the owner''s 0.10';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vendor_invites' AND column_name = 'first_opened_at'
  ) THEN
    RAISE EXCEPTION 'add_your_own: vendor_invites.first_opened_at is missing';
  END IF;
END $$;

COMMIT;
