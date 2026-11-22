-- the_new_client_free_window_is_a_setting
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION. No data is
-- written except the column's own default on the one settings row.
--
-- ── THE RULINGS (specs DECISION_LOG) ─────────────────────────────────────────────────────────────────────────────────
--   2026-11-16 "IMPORTED CLIENTS: A NEW ACCOUNT IS FREE FOR ONE YEAR WITH THAT SUPPLIER…" (1): the import creates the
--     client's Setnayan account → no booking fee for 12 months from the import, on every booking that client makes with
--     that supplier. (2) an existing account → free only for the new event this supplier is the first import on.
--   2026-11-20 "BILLING MUST FOLLOW THE RETIRED COPY" (2): supplier-brought clients are free only as the 16 Nov row
--     rules; it must not take back a waiver already granted.
--   2026-11-19 "PROMOTION PAGES" (4): "this is a ruling that it is a new account, or they are the first supplier QR";
--     no number of months is named on any page.
--
-- ── RULE 0: WHAT ALREADY SHIPPED, AND THE ONE DELTA ──────────────────────────────────────────────────────────────────
--   The 12-month arm already exists: `booking_fee_attribution_for` (20271352882666 → 20271352968519 → 20271353556136)
--   frees a verified shop's import that created the client's account (`booking_fee_import_created_account`, dated by
--   `booking_fee_import_at`, owner Q1 invite timestamp) on every event of that client, and the existing-account arm is
--   the event's one free import slot. No second exemption is added and no new timestamp: "this import created the
--   account, at time T" is already `booking_fee_import_created_account` + `booking_fee_import_at`.
--   What was wrong: the window was TYPED into the function (`NOW() - INTERVAL '12 months'`) — a number that governs
--   money, in code. It now lives in `platform_settings.booking_fee_new_client_free_months` (12) and is read by
--   `booking_fee_new_client_window_covers(import_at, at)`, which the attribution calls with NOW() (the lock reads the
--   attribution at the yes, and the ledger freezes it there). Twin: `newClientWindowCovers` in
--   apps/web/lib/booking-fee-lock.ts.
--   Boundary (unchanged): free while the import is strictly LESS than N months before the booking; at exactly N months,
--   and after, the normal fee applies.
--   A missing settings row reads NULL → not covered → the fee (fails toward the fee, never toward free).
--
-- Amendments already keep the basis they were locked on: `booking_fee_open_lock_charge` freezes the attribution on the
-- ledger (ON CONFLICT never rewrites it) and `booking_fee_rederive_lock_fee` returns 'import_noop' for a
-- `waived_import` primary — so a booking waived inside the window stays waived when amended after it, and a booking
-- billed after it is never waived by a later change of the setting. Pinned by the DB test, not changed here.

BEGIN;

-- A busy platform_settings row must not hold the deploy: give up after 5 s rather than queue behind it.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_new_client_free_months INTEGER NOT NULL DEFAULT 12
    CHECK (booking_fee_new_client_free_months > 0);
COMMENT ON COLUMN public.platform_settings.booking_fee_new_client_free_months IS
  'Months a client whose Setnayan account a verified shop''s import created books THAT shop with no booking fee, counted '
  'from the import (owner 2026-11-16 "A NEW ACCOUNT IS FREE FOR ONE YEAR WITH THAT SUPPLIER": 12). Free while the '
  'import is less than this many months before the booking; at exactly this many months, and after, the fee applies. '
  'Read by public.booking_fee_new_client_window_covers and by apps/web/lib/booking-fee-settings.server.ts. Named only '
  'in the supplier''s own app and receipts — never on a public page (2026-11-19 PROMOTION PAGES (4)).';

-- ── The window, read from settings ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_new_client_window_covers(
  p_import_at TIMESTAMPTZ,
  p_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    p_import_at > p_at - make_interval(months => (
      SELECT s.booking_fee_new_client_free_months FROM public.platform_settings s WHERE s.id = 1
    )),
    false
  );
$$;
COMMENT ON FUNCTION public.booking_fee_new_client_window_covers(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'True while an import that created the client''s account (p_import_at) is less than '
  'platform_settings.booking_fee_new_client_free_months months before p_at. Calendar months, as Postgres interval '
  'arithmetic (a month-end day clamps). NULL anywhere → false (the fee). Twin of newClientWindowCovers in '
  'apps/web/lib/booking-fee-lock.ts.';
REVOKE ALL ON FUNCTION public.booking_fee_new_client_window_covers(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_new_client_window_covers(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_new_client_window_covers(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_new_client_window_covers(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ── The attribution: 20271353556136 verbatim, except the one line marked ⟵ WINDOW ──────────────────────────────────
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
    -- (1) The import brought the client onto Setnayan, after the shop was verified, inside the new-client window
    --     (platform_settings.booking_fee_new_client_free_months), with no Setnayan fact first: free with this shop on
    --     every event of that client.
    WHEN EXISTS (
      SELECT 1
        FROM couple_events ce
       WHERE public.booking_fee_import_created_account(p_vendor_profile_id, ce.event_id)
         AND public.booking_fee_new_client_window_covers(                                       -- ⟵ WINDOW
               public.booking_fee_import_at(p_vendor_profile_id, ce.event_id), NOW())
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
  'invite created the shop (1abf35b); a verified shop''s import brought the client onto Setnayan, inside '
  'platform_settings.booking_fee_new_client_free_months of the import (d4899cd5, invite timestamp Q1; '
  'booking_fee_new_client_window_covers); the event''s one free import slot, imported after verification (9fe95ebe, '
  '993cdb9). Everything else is sourced: an unverified shop (99b6ab50), a Setnayan fact, the same couple found by '
  'Setnayan earlier (HOLE 3 - that event''s Setnayan facts, never its frozen stamp), '
  'an existing shop claiming the couple''s invite, a later import, and a booking with nothing imported (Q3). Bookings '
  'already made keep the attribution frozen in booking_fee_ledger.';
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;

-- ── The published Journal post names no length (2026-11-19 PROMOTION PAGES (4): "No number of months is named on any
-- page"). `what-zero-commission-means-for-couples` was imported by 20271355899662 (applied) and still says "for a
-- year"; an applied migration is never edited, so this UPDATE makes the one edit `lib/blog-batches/december-news.ts`
-- carries (listed in lib/journal-edits-after-import.ts, proven by lib/journal-move.test.ts 6b). Idempotent: the WHERE
-- matches only while the old clause is present.
UPDATE public.creator_chapters
   SET body = replace(
         body,
         $old$books it free, and a couple a supplier brings onto Setnayan books them free for a year. Every other booking$old$,
         $new$books it free, and a couple new to Setnayan through a supplier books them free. Every other booking$new$
       ),
       updated_at = now()
 WHERE is_journal IS TRUE
   AND slug = 'what-zero-commission-means-for-couples'
   AND position($old$books them free for a year.$old$ IN body) > 0;

COMMIT;
