-- Reusable Locked Bookings — the couple re-books a past vendor, the vendor
-- ⚠ RE-ALLOCATED 2026-08-04. Shipped originally as 20270929330649, whose prefix
--   had fallen BELOW main's applied head (20271102113000) while this PR sat open.
--   Migrations apply once, in prefix order, so the original would have merged
--   green and created NOTHING — and the flag comment told the owner to flip the
--   feature on AFTER pushing it. SQL unchanged. Verify the OBJECT after merge:
--     SELECT to_regclass('public.vendor_reuse_requests');   -- must be non-NULL
-- re-prices, and it becomes a NEW lock = a NEW fee (owner-locked 2026-07-24).
--
-- TWO LAYERS, kept strictly apart:
--   • TEMPLATE (vendor-owned): the scope/inclusions. Snapshotted into
--     `scope_snapshot` as [{label, detail}] ONLY — never a price, never the
--     source couple's PII (merge_snapshot / rendered_body are NEVER copied).
--   • INSTANCE (couple-owned): the TARGET event + the vendor's point-in-time
--     re-quote. Lands as a fresh event_vendors row in the target event.
--
-- NEW-LOCK-NEW-FEE is STRUCTURAL, not bolted on: reuse always produces a booking
-- in the TARGET event, a DISTINCT (vendor_profile_id, event_id) from the source.
-- booking_fee_open_lock_charge keys the ledger on (vendor_profile_id, event_id)
-- and the charge on event_vendor_id, freezing the free-5 ordinal per ledger row.
-- A new event ⇒ a new ledger row ⇒ its own frozen ordinal ⇒ its own charge; the
-- source event's charge / fee-paid state is UNREACHABLE. The CHECK below forbids
-- re-booking into the SAME event (which would collide with the existing charge
-- and wrongly read as already-paid/free), and the one-live partial unique index
-- forbids a second in-flight reuse into the same target for the same vendor.
--
-- Ships DARK: nothing writes this table until the couple/vendor actions land AND
-- NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED is flipped. No money moves here — the fee
-- is collected only when the couple LOCKS the resulting event_vendors row through
-- the UNCHANGED finalizeVendor → collectBookingFeeAtLock path.
--
-- WRITES are service-role only (every server action re-derives identity from
-- auth.getUser() and checks ownership before writing via the admin client, the
-- same posture as the booking-fee RPCs). RLS grants SELECT to the three parties.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_reuse_requests (
  request_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lineage / audit only. ON DELETE SET NULL so purging a past booking never
  -- orphans a live reuse request. NEVER a data-carry channel — the scope is
  -- copied into scope_snapshot at create time, not read back from the source.
  source_event_vendor_id UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  source_event_id        UUID REFERENCES public.events(event_id) ON DELETE SET NULL,

  -- The vendor being re-booked (the template owner).
  vendor_profile_id      UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,

  -- The couple's NEW event (the instance owner) + who kicked it off.
  target_event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  requested_by_user_id   UUID NOT NULL,

  -- Snapshot fields used to seed the new booking. category/vendor_name are
  -- vendor-owned identity, safe to carry. scope_snapshot is the sanitized,
  -- price-free, PII-free inclusions list.
  category               public.vendor_category,
  vendor_name            TEXT,
  scope_snapshot         JSONB NOT NULL DEFAULT '[]',

  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'quoted', 'accepted', 'declined', 'cancelled')),

  -- The vendor's NEW price (point-in-time). NULL until the vendor re-quotes.
  quoted_total_php       NUMERIC(12,2) CHECK (quoted_total_php IS NULL OR quoted_total_php >= 0),
  decline_reason         TEXT,

  -- The fresh event_vendors row minted on accept (the new instance).
  resolved_event_vendor_id UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,

  quoted_at              TIMESTAMPTZ,
  resolved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same-event reuse is forbidden: it would collide with the existing
  -- (vendor, event) charge and wrongly inherit its paid/free state.
  CONSTRAINT vendor_reuse_requests_distinct_event_ck
    CHECK (source_event_id IS NULL OR source_event_id <> target_event_id)
);

-- One LIVE reuse request per (target event × vendor). A resolved (declined /
-- cancelled) request frees the slot for a fresh attempt.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_reuse_requests_one_live_per_target_vendor
  ON public.vendor_reuse_requests(target_event_id, vendor_profile_id)
  WHERE status IN ('pending', 'quoted', 'accepted');

CREATE INDEX IF NOT EXISTS vendor_reuse_requests_vendor_idx
  ON public.vendor_reuse_requests(vendor_profile_id, status);
CREATE INDEX IF NOT EXISTS vendor_reuse_requests_target_event_idx
  ON public.vendor_reuse_requests(target_event_id, status);

-- ── RLS — SELECT for the three parties; all WRITES are service-role only ──────
ALTER TABLE public.vendor_reuse_requests ENABLE ROW LEVEL SECURITY;

-- Admin: full visibility (ops / disputes).
CREATE POLICY vendor_reuse_requests_admin_all
  ON public.vendor_reuse_requests FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Couple / moderator of the TARGET event may read their reuse requests.
CREATE POLICY vendor_reuse_requests_couple_read
  ON public.vendor_reuse_requests FOR SELECT TO authenticated
  USING (
    target_event_id IN (SELECT public.current_couple_event_ids())
    OR target_event_id IN (SELECT public.current_moderator_event_ids())
  );

-- The vendor being re-booked may read requests addressed to them.
CREATE POLICY vendor_reuse_requests_vendor_read
  ON public.vendor_reuse_requests FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- ⚠ MANDATORY, AND IT WAS MISSING (added 2026-08-04). Every new table in the
-- `public` schema ships OPEN: the database's default ACL hands anon AND
-- authenticated full SELECT/INSERT/UPDATE/DELETE at the TABLE level, and RLS
-- does not undo a table-level GRANT. The exposure baseline caught it — this
-- table was regenerating as:
--     tpriv public.vendor_reuse_requests|anon           SIUD
--     col   public.vendor_reuse_requests.quoted_total_php  anon=SIU …
-- i.e. anon-reachable surface on a table holding vendors' quoted prices and
-- decline reasons. Every policy above is TO authenticated, so anon has no
-- business here at any level.
REVOKE ALL ON public.vendor_reuse_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_reuse_requests TO authenticated;

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.tg_vendor_reuse_requests_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_reuse_requests_touch ON public.vendor_reuse_requests;
CREATE TRIGGER vendor_reuse_requests_touch
  BEFORE UPDATE ON public.vendor_reuse_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_reuse_requests_touch();

COMMENT ON TABLE public.vendor_reuse_requests IS
  'Reusable Locked Bookings: a couple-initiated request to re-book a past vendor '
  'into a NEW event. Carries the vendor-owned scope (scope_snapshot, price-free & '
  'PII-free); the vendor re-prices (quoted_total_php) or declines. On accept a '
  'fresh event_vendors row is minted in the target event and locked through the '
  'unchanged finalizeVendor → collectBookingFeeAtLock path (new event = new fee). '
  'Ships dark behind NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED. Writes service-role only.';

COMMIT;
