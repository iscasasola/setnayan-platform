-- vendor_agrees_to_lock
-- ============================================================================
-- PR-H · STEP 2 OF THE LOCK HANDSHAKE — THE VENDOR AGREES (data layer only).
--
-- Owner ruling 2026-07-27 (Explore_Replan_BUILD_SPEC_2026-07-27.md §7): a couple
-- LOCKING a vendor is only a REQUEST. The vendor must AGREE before the couple is
-- asked to pay. The full ladder:
--
--   1 couple requests lock
--   2 VENDOR AGREES              ← MISSING until this migration
--   3 vendor sends payment request
--   4 customer pays + uploads screenshot
--   5 vendor accepts payment (acknowledge_vendor_deposit) → LOCKED
--
-- Steps 3/4/5 ship. Step 2 did not exist: today finalizeVendor() flips the row
-- to 'contracted' and the vendor's ONLY involvement is an emitNotification
-- titled "You have a new confirmed booking"
-- (apps/web/app/dashboard/[eventId]/vendors/actions.ts:1529-1545). The vendor is
-- TOLD, never ASKED — apps/web/app/vendor-dashboard/bookings/actions.ts exports
-- only vendorAddPreparationItem / vendorDeletePreparationItem; there is no
-- accept/agree/decline anywhere on the vendor side of a booking.
--
-- ── SHAPE DECISION: COLUMNS ON event_vendors, NOT A vendor_lock_requests TABLE ─
--
-- The spec offers both (Explore_Replan_BUILD_SPEC_2026-07-27.md:121). Columns win
-- on three counts, each evidenced:
--
--   (a) THE OWNER LOCK ENDORSES EXACTLY THIS SHAPE. 20270320429117:15-18 —
--       "we do NOT repurpose the event_vendors.status enum. 'Recorded-but-
--       unsettled' and 'vendor-acknowledged' are nullable timestamp/url columns
--       orthogonal to the status ladder — exactly the precedent set by
--       contract_signed_at in 20270217864104." deposit_recorded_at /
--       deposit_acknowledged_at IS a host-asks → vendor-answers handshake on
--       event_vendors, one rung further up this same ladder. PR-H is its twin.
--
--   (b) THE CONFLICT GATE LIVES ON THIS TABLE AND CANNOT REACH ANOTHER ONE.
--       event_vendors_hard_single_lock_uniq (20261210000000:100-104) is a partial
--       unique index on (event_id, hard_single_group), where hard_single_group is
--       a GENERATED STORED column of event_vendors mirroring 7 category literals
--       (20261210000000:78-91). A separate table has no such column, so any
--       cross-table single-slot invariant needs a trigger plus a THIRD hand-typed
--       copy of the category→group map (the TS copy is
--       apps/web/lib/wedding-plan-groups.ts:639-646). Two hand-typed things that
--       must agree is the exact guard shape this corpus has already been burned by.
--
--   (c) THE FORGERY GUARD ALREADY EXISTS HERE. 20270323841750:48-70 installs
--       guard_event_vendor_deposit_ack() precisely because
--       event_vendors_couple_write is FOR ALL with no column restriction
--       (20260513100000:113-118) and authenticated/anon hold a table-wide UPDATE
--       grant. A new lock_agreed_at column reproduces that hole one-for-one; §4
--       below closes it with the same mechanism rather than inventing a new one.
--
-- vendor_lock_proposals (20270729130000) is deliberately NOT extended: it is a
-- different actor pair — COORDINATOR proposes → COUPLE confirms (the propose-not-
-- execute money wall), flag-dark behind NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED
-- (20270729130000:17-19). It has no vendor side at all. It is also the one table
-- in this family that shipped with NO REVOKE, so anon holds SIUD on it
-- (supabase/security/exposure-surface.baseline.txt:572-573) — a defect this
-- migration must not mirror.
--
-- ── WHAT THIS MIGRATION DOES NOT TOUCH ───────────────────────────────────────
--
--   · event_vendors.status — NEVER repurposed. Not read, not written, not
--     widened, no new enum label. Whether step 1 keeps writing 'contracted' is an
--     app-layer call, unchanged here.
--   · Any money column. deposit_*, deposit_paid_php, the booking fee, payouts,
--     event_vendor_payments — all untouched. This is a SIGNAL, not money.
--   · event_vendors_hard_single_lock_uniq — its predicate is NOT widened to count
--     pending requests. Doing so requires four hand-copied app-side readers to
--     move in the same commit (actions.ts:822-843, :622-649, :610-617,
--     lib/chat-lock-booking.server.ts:107-109) or the couple gets a raw 23505
--     toast instead of the Switch/Cancel modal. Out of scope; see notBuilt.
--
-- Idempotent + re-runnable: ADD COLUMN IF NOT EXISTS · guarded ADD CONSTRAINT ·
-- CREATE {UNIQUE} INDEX IF NOT EXISTS · CREATE OR REPLACE FUNCTION ·
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · Orthogonal lock-handshake markers on the booking ledger.
--     Nullable columns alongside the status ladder — NOT a new status value.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS lock_requested_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_requested_by_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lock_request_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_request_state        TEXT,
  ADD COLUMN IF NOT EXISTS lock_agreed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_declined_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_decline_reason       TEXT,
  ADD COLUMN IF NOT EXISTS lock_answered_by_user_id  UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lock_request_cancelled_at TIMESTAMPTZ;

-- The two user stamps are ACTOR marks, not subject data, so ON DELETE SET NULL —
-- rule G6 in apps/web/lib/erasure/coverage-guardrail.test.ts (CASCADE+NOT NULL ⇒
-- the row is ABOUT them and dies with them; SET NULL ⇒ an actor stamp, the row
-- survives). Nulling either one does NOT re-open a settled request: the state
-- machine is lock_request_state, which these FKs cannot reach. (Contrast the
-- paparazzi_seats.claimer_user_id incident, where an ON DELETE SET NULL FK
-- silently un-claimed a seat because the STATE lived in the nulled column.)

COMMENT ON COLUMN public.event_vendors.lock_request_state IS
  'PR-H step 2 of the lock handshake (owner ruling 2026-07-27): NULL = the couple never asked; pending = asked, awaiting the vendor; agreed = the vendor said yes (vendor_agree_to_lock); declined = the vendor said no (vendor_decline_lock); cancelled = the couple withdrew (cancel_vendor_lock_request, the spec''s Undo); expired = the ~7-day window lapsed, flipped lazily on read-time answer, never by a sweeper. ORTHOGONAL to event_vendors.status, which is NEVER repurposed (owner lock, 20270320429117:15-18).';

COMMENT ON COLUMN public.event_vendors.lock_requested_at IS
  'Set when the COUPLE asks this vendor to agree to be locked. Written by the couple''s own path (their FOR ALL write policy permits it, exactly as it permits deposit_recorded_at); the vendor''s ANSWER is DEFINER-only. NULL = never asked.';

COMMENT ON COLUMN public.event_vendors.lock_request_expires_at IS
  'MATERIALIZED ~7-day deadline, stamped by event_vendors_guard_lock_handshake when a row enters pending. Materialized rather than derived because a Postgres partial-index predicate must be IMMUTABLE — now() cannot appear in one — so any future index or gate that wants to ignore stale requests needs a stored column to read. NO SWEEPER EXISTS: expiry is enforced lazily by vendor_agree_to_lock / vendor_decline_lock, which flip a lapsed pending row to expired and refuse (the shipped lazy-expiry idiom, apps/web/lib/vendor-invites.ts:213-224).';

COMMENT ON COLUMN public.event_vendors.lock_agreed_at IS
  'Set by the VENDOR via vendor_agree_to_lock() — "yes, book me". Single-winner SECURITY DEFINER transition (FOR UPDATE + state precondition repeated in the WHERE), never a 2-way write. DEFINER-only: the guard trigger rejects any authenticated/anon write, or the couple could forge their own vendor''s agreement through the column-unrestricted FOR ALL couple-write policy.';

COMMENT ON COLUMN public.event_vendors.lock_declined_at IS
  'Set by the VENDOR via vendor_decline_lock(). DEFINER-only, same guard as lock_agreed_at.';

COMMENT ON COLUMN public.event_vendors.lock_decline_reason IS
  'The vendor''s own words when declining, <= 240 chars. PERSISTED here on purpose: reject_vendor_deposit(p_reason) accepts a reason and never stores it (20270722461308:28, unreferenced in the body) — the text survives only as notification prose assembled in app code. A declined booking must still be able to say WHY six months later.';

COMMENT ON COLUMN public.event_vendors.lock_request_cancelled_at IS
  'Set when the COUPLE withdraws a still-pending request (the spec''s Undo).';

-- ----------------------------------------------------------------------------
-- 2 · Domain + coherence constraints.
--     ADD CONSTRAINT has no IF NOT EXISTS, so each is guarded on pg_constraint.
--     Every existing row has lock_request_state IS NULL, so all four validate
--     trivially on a full scan.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_vendors'::regclass
       AND conname  = 'event_vendors_lock_request_state_chk'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_lock_request_state_chk
      CHECK (
        lock_request_state IS NULL
        OR lock_request_state IN
             ('pending', 'agreed', 'declined', 'cancelled', 'expired')
      );
  END IF;

  -- A pending request must have somebody who can ANSWER it. An off-platform /
  -- custom vendor has no Setnayan account, so it can never reach step 2 — and
  -- this is also what makes the partial unique index in §3 airtight, since NULLs
  -- never collide in a unique index.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_vendors'::regclass
       AND conname  = 'event_vendors_lock_request_marketplace_chk'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_lock_request_marketplace_chk
      CHECK (
        lock_request_state IS DISTINCT FROM 'pending'
        OR marketplace_vendor_id IS NOT NULL
      );
  END IF;

  -- Every terminal state carries its own timestamp, so "when did this happen"
  -- is never reconstructed from a neighbouring column.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_vendors'::regclass
       AND conname  = 'event_vendors_lock_request_coherence_chk'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_lock_request_coherence_chk
      CHECK (
        (lock_request_state IS DISTINCT FROM 'pending'
           OR lock_requested_at IS NOT NULL)
        AND (lock_request_state IS DISTINCT FROM 'agreed'
           OR lock_agreed_at IS NOT NULL)
        AND (lock_request_state IS DISTINCT FROM 'declined'
           OR lock_declined_at IS NOT NULL)
        AND (lock_request_state IS DISTINCT FROM 'cancelled'
           OR lock_request_cancelled_at IS NOT NULL)
      );
  END IF;

  -- Same 240 cap as the coordinator-access note (20271014200000:52).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_vendors'::regclass
       AND conname  = 'event_vendors_lock_decline_reason_chk'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_lock_decline_reason_chk
      CHECK (
        lock_decline_reason IS NULL
        OR char_length(btrim(lock_decline_reason)) BETWEEN 1 AND 240
      );
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3 · ONE LIVE REQUEST PER (EVENT, VENDOR) — enforced by the DATABASE.
--
--     Not by app code: a couple can hold several event_vendors rows pointing at
--     the SAME marketplace vendor (different categories, a re-added pick, a
--     duplicate from the wizard), and three separate code paths reach a lock
--     (finalizeVendor, the chat "lock this deal" arm, the onboarding wizard).
--     An app-level count would have to be duplicated into all three and would
--     not be race-safe. A partial unique index is, and it is path-independent —
--     the same property the hard-single guard was built for (20261210000000:18-23).
--
--     PARTIAL on state = 'pending' so the audit trail survives: agreed, declined,
--     cancelled and expired rows stay readable and a couple may ask again after a
--     decline. Mirrors vendor_lock_proposals_one_pending_uniq (20270729130000:45-47)
--     and event_access_requests_one_pending_idx (20271014200000:69-71).
--
--     archived_at IS NULL echoes the hard-single predicate: an archived pick that
--     a Switch displaced must not keep occupying the slot.
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_one_pending_lock_request_uniq
  ON public.event_vendors (event_id, marketplace_vendor_id)
  WHERE lock_request_state = 'pending' AND archived_at IS NULL;

-- The vendor's inbox read ("which couples are waiting on me?"), which today runs
-- through the service_role admin client scoped to the vendor's own profile —
-- event_vendors carries couple-only RLS (apps/web/lib/vendor-overview.ts:44-49).
CREATE INDEX IF NOT EXISTS event_vendors_pending_lock_request_idx
  ON public.event_vendors (marketplace_vendor_id, lock_requested_at DESC)
  WHERE lock_request_state = 'pending';

-- ----------------------------------------------------------------------------
-- 4 · FORGERY GUARD + expiry materialization.
--
--     WHY THIS IS MANDATORY, not defensive polish: event_vendors_couple_write is
--     `FOR ALL` with no column list (20260513100000:113-118), and BOTH
--     authenticated and anon hold a TABLE-WIDE UPDATE grant on event_vendors (the
--     Supabase default ACL). A table-level UPDATE confers UPDATE on every column
--     regardless of any column-level REVOKE, so without this trigger a couple
--     could set lock_agreed_at / lock_request_state='agreed' on their own booking
--     through a raw PostgREST call and manufacture their vendor's consent. This
--     is bug A of 20270323841750 reproduced one rung up the ladder; the fix is
--     the same mechanism, deliberately NOT a new one.
--
--     A SEPARATE trigger function from guard_event_vendor_deposit_ack() so that
--     function's name stays honest about what it guards. Both are BEFORE ROW on
--     event_vendors and are independent.
--
--     WHAT IS AND IS NOT GUARDED: the couple legitimately opens and withdraws
--     their own request, exactly as recordDeposit legitimately writes
--     deposit_recorded_at. So pending / cancelled transitions stay open to the
--     couple's own client. Only the VENDOR'S ANSWER is DEFINER-only.
--
--     The DEFINER RPCs below run as the table owner (current_user = 'postgres')
--     and pass; the service_role admin client passes; authenticated/anon are
--     rejected the instant they touch an answer column.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_event_vendor_lock_handshake()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $guard$
BEGIN
  -- ⚠ INSERT IS GUARDED TOO, AND THAT IS THE WHOLE POINT.
  -- This block used to be wrapped in `TG_OP = 'UPDATE'`, which left INSERT
  -- completely unchecked. `event_vendors_couple_write` is FOR ALL with no column
  -- list, so a couple's own client could INSERT a row BORN 'agreed' — with
  -- lock_agreed_at and lock_answered_by_user_id filled in — and manufacture a
  -- vendor's consent to being booked. The vendor never sees a request; the row
  -- simply exists as though they had said yes.
  --
  -- On INSERT there is no OLD row, so the test is different in shape but the
  -- same in intent: a NEW row may not arrive already carrying the vendor's
  -- answer. A couple may create a row that is NULL (no request) or 'pending'
  -- (they are asking) — nothing further along than that.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.lock_agreed_at IS NOT NULL
         OR NEW.lock_declined_at IS NOT NULL
         OR NEW.lock_decline_reason IS NOT NULL
         OR NEW.lock_answered_by_user_id IS NOT NULL
         OR NEW.lock_request_state IN ('agreed', 'declined', 'expired')
      THEN
        RAISE EXCEPTION
          'a booking cannot be created already carrying the vendor''s lock answer'
          USING ERRCODE = '42501';
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.lock_agreed_at           IS DISTINCT FROM OLD.lock_agreed_at
         OR NEW.lock_declined_at      IS DISTINCT FROM OLD.lock_declined_at
         OR NEW.lock_decline_reason   IS DISTINCT FROM OLD.lock_decline_reason
         OR NEW.lock_answered_by_user_id
                                      IS DISTINCT FROM OLD.lock_answered_by_user_id
      THEN
        RAISE EXCEPTION
          'the vendor''s lock answer is vendor-set only (via vendor_agree_to_lock / vendor_decline_lock)'
          USING ERRCODE = '42501';
      END IF;

      -- The state machine itself: a couple may open (pending) or withdraw
      -- (cancelled) their own request, but may not declare the vendor's verdict.
      IF NEW.lock_request_state IS DISTINCT FROM OLD.lock_request_state
         AND NEW.lock_request_state IN ('agreed', 'declined', 'expired')
      THEN
        RAISE EXCEPTION
          'lock_request_state ''%'' is set only by the vendor lock-handshake RPCs',
          NEW.lock_request_state
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Materialize the ~7-day deadline the moment a row becomes pending, so the
  -- TTL is stored ONCE here rather than hand-typed into every reader. Fires on
  -- INSERT too — the onboarding wizard inserts event_vendors rows directly.
  -- ⚠ ON EVERY TRANSITION INTO 'pending', NOT ONLY WHEN THE DEADLINE IS NULL.
  -- The old `AND NEW.lock_request_expires_at IS NULL` meant a SECOND ask — the
  -- couple asking again after a decline or an expiry — inherited the dead
  -- deadline from the first one. The row was born already expired: the vendor
  -- would never get a chance to answer, and the couple would be told nobody
  -- replied, instantly and silently.
  --
  -- Keyed on the TRANSITION (was not pending, is now) so a later touch of an
  -- already-pending row never silently extends the vendor's window.
  IF NEW.lock_request_state = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.lock_request_state IS DISTINCT FROM 'pending')
  THEN
    NEW.lock_request_expires_at :=
      COALESCE(NEW.lock_requested_at, NOW()) + INTERVAL '7 days';
  END IF;

  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS event_vendors_guard_lock_handshake ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_lock_handshake
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_event_vendor_lock_handshake();

COMMENT ON FUNCTION public.guard_event_vendor_lock_handshake() IS
  'BEFORE INSERT OR UPDATE guard on event_vendors. (1) Rejects any authenticated/anon write to the VENDOR''s lock answer (lock_agreed_at, lock_declined_at, lock_decline_reason, lock_answered_by_user_id) or any direct flip of lock_request_state to agreed/declined/expired — closing the same couple-forgeable hole guard_event_vendor_deposit_ack closes for the deposit, which exists because the couple write policy is FOR ALL with no column list and authenticated/anon hold a table-wide UPDATE grant. The couple''s own pending/cancelled transitions stay permitted, mirroring their legitimate deposit_recorded_at write. (2) Materializes lock_request_expires_at = requested_at + 7 days when a row enters pending, so the TTL is stored once instead of hand-typed into every reader.';

-- ----------------------------------------------------------------------------
-- 5 · vendor_agree_to_lock — the VENDOR single-winner AGREE RPC. STEP 2.
--
--     Modeled EXACTLY on acknowledge_vendor_deposit (20270320429117:60-130),
--     which is itself modeled on respond_vendor_proposal (20261209000000:184-236):
--       ownership gate BEFORE any read
--       SELECT … FOR UPDATE            → serializes concurrent answerers
--       precondition returns            → non-transitions answer, never raise
--       UPDATE … WHERE same precondition + GET DIAGNOSTICS ROW_COUNT
--                                       → atomically single-winner even if the
--                                         row lock above is ever removed
--       idempotent graceful re-call     → a double-click reports 'already'
--
--     p_event_vendor_id matches event_vendors.vendor_id — that column IS the
--     table's UUID primary key (20260513100000:80-81). There is no column named
--     event_vendor_id on event_vendors.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(
  p_event_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state      TEXT;
  v_expires_at TIMESTAMPTZ;
  v_agreed_at  TIMESTAMPTZ;
  v_rows       INTEGER;
BEGIN
  -- Ownership — DEFINER + granted to authenticated, so gate explicitly. The
  -- caller must be the asked vendor (owner/admin/agent on this booking) or a
  -- platform admin. current_vendor_event_vendor_ids() resolves the exact
  -- event_vendors.vendor_id set the vendor org owns (20270315091571:32-48); it
  -- selects a NOT NULL primary key, so this NOT IN cannot yield NULL and cannot
  -- fail open. Deliberately NOT current_vendor_booked_event_ids(), which is
  -- circular here — it only returns events already at contracted/deposit_paid/
  -- delivered/complete, and a vendor being ASKED is by definition not yet there.
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_agreed_at
    INTO v_state, v_expires_at, v_agreed_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Nothing to answer.
  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested');
  END IF;

  -- IDEMPOTENCY: a re-call on an already-agreed row returns gracefully — the
  -- single-winner already won — so the vendor UX still shows "agreed".
  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object('status', 'already', 'agreed_at', v_agreed_at);
  END IF;

  -- Terminal states are REFUSALS, not idempotency. A declined or withdrawn
  -- request cannot be revived by answering it; the couple must ask again.
  IF v_state IN ('declined', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_state);
  END IF;

  -- LAZY EXPIRY (no sweeper exists): a pending request past its deadline is
  -- flipped here, on the answer path, rather than by a scheduled job. Flipping
  -- rather than merely refusing matters — it releases
  -- event_vendors_one_pending_lock_request_uniq so the couple can ask again.
  -- Same idiom as the vendor-invite claim token (lib/vendor-invites.ts:213-224).
  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object('status', 'expired', 'expired_at', v_expires_at);
  END IF;

  -- State precondition repeated in the WHERE (defense in depth alongside FOR
  -- UPDATE): the transition is atomically single-winner even if the lock above
  -- is ever removed. lock_request_state = 'pending' is the single-winner gate.
  UPDATE public.event_vendors
     SET lock_request_state       = 'agreed',
         lock_agreed_at           = NOW(),
         lock_answered_by_user_id = auth.uid(),
         lock_declined_at         = NULL,
         lock_decline_reason      = NULL,
         updated_at               = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND lock_request_state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent answerer between the FOR UPDATE read and
    -- the UPDATE (only possible if the lock is removed) — re-read and report.
    SELECT lock_request_state, lock_agreed_at INTO v_state, v_agreed_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'current', v_state, 'agreed_at', v_agreed_at);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'agreed_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_agree_to_lock(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_agree_to_lock(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.vendor_agree_to_lock(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_agree_to_lock(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_agree_to_lock(UUID) IS
  'PR-H step 2: the VENDOR agrees to a couple''s lock request. Serialized via SELECT FOR UPDATE + a lock_request_state=''pending'' precondition repeated in the UPDATE''s WHERE, so concurrent answers are single-winner; an idempotent re-call returns status=already. Ownership-gated to the asked vendor (current_vendor_event_vendor_ids) or admin. Flips a lapsed pending row to expired lazily instead of relying on a sweeper. Agreeing is a SIGNAL and moves no money and no status: event_vendors.status is never repurposed (owner lock).';

-- ----------------------------------------------------------------------------
-- 6 · vendor_decline_lock — the VENDOR single-winner DECLINE RPC.
--
--     Six deltas from §5, everything else byte-identical — the same relationship
--     reject_vendor_deposit has to acknowledge_vendor_deposit (20270722461308:14-16).
--     The one place it deliberately DIVERGES from that precedent: p_reason is
--     PERSISTED. reject_vendor_deposit takes p_reason and never references it
--     again (20270722461308:28 vs :34-99), so the vendor's words survive only as
--     notification prose. A refusal that cannot be re-read later is not a record.
--
--     It also does NOT copy that RPC's trailing
--     `DELETE … WHERE notes LIKE '%awaiting vendor confirmation%'` — an unguarded
--     side effect matched on a human-readable string that app code stamps. There
--     is no ledger to clean here, and nothing in this migration touches money.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_decline_lock(
  p_event_vendor_id UUID,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state       TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_declined_at TIMESTAMPTZ;
  v_reason      TEXT;
  v_rows        INTEGER;
BEGIN
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- Normalize to the stored shape: blank becomes NULL, and the 240-char CHECK is
  -- pre-empted here so an over-long reason is a clean truncation rather than a
  -- constraint violation surfacing as a raw Postgres string in the vendor's UI.
  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NOT NULL THEN
    v_reason := left(v_reason, 240);
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_declined_at
    INTO v_state, v_expires_at, v_declined_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested');
  END IF;

  IF v_state = 'declined' THEN
    RETURN jsonb_build_object('status', 'already', 'declined_at', v_declined_at);
  END IF;

  -- An agreement already given is final on this rung — walking it back is a
  -- cancellation of a live booking, a different action with different
  -- consequences downstream. Mirrors reject_vendor_deposit's already_confirmed
  -- refusal (20270722461308:60-63).
  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object('status', 'already_agreed');
  END IF;

  IF v_state IN ('cancelled', 'expired') THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_state);
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object('status', 'expired', 'expired_at', v_expires_at);
  END IF;

  UPDATE public.event_vendors
     SET lock_request_state       = 'declined',
         lock_declined_at         = NOW(),
         lock_decline_reason      = v_reason,
         lock_answered_by_user_id = auth.uid(),
         updated_at               = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND lock_request_state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'declined_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_decline_lock(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_decline_lock(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.vendor_decline_lock(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_decline_lock(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_decline_lock(UUID, TEXT) IS
  'PR-H step 2 (the no): the VENDOR declines a couple''s lock request, with an optional reason that IS PERSISTED to lock_decline_reason — unlike reject_vendor_deposit''s p_reason, which is accepted and never stored. Same single-winner shape as vendor_agree_to_lock. An already-agreed request is REFUSED rather than reversed; withdrawing a live booking is a different action. Ownership-gated to the asked vendor or admin.';

-- ----------------------------------------------------------------------------
-- 7 · cancel_vendor_lock_request — the COUPLE withdraws. The spec's "Undo".
--
--     Gated to the COUPLE, not couple-or-coordinator. Precedent:
--     vendor_lock_proposals_couple_update uses current_couple_event_ids()
--     (20270729130000:74-77), and 20271016300000:31-38 narrowed six host policies
--     from the member-wide predicate for exactly this reason — "a coordinator
--     could APPROVE THEIR OWN REQUEST". A coordinator who proposed a lock must
--     not also be able to erase the evidence of it.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_vendor_lock_request(
  p_event_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state        TEXT;
  v_cancelled_at TIMESTAMPTZ;
  v_rows         INTEGER;
BEGIN
  -- Ownership gate. EXISTS form rather than NOT IN because the id set here is
  -- resolved by joining to the row itself; event_members.event_id is NOT NULL
  -- (20260512000000:127) so either form is NULL-safe, and EXISTS stays safe if
  -- the predicate is ever widened to a nullable column.
  IF NOT EXISTS (
       SELECT 1
         FROM public.event_vendors ev
        WHERE ev.vendor_id = p_event_vendor_id
          AND ev.event_id IN (SELECT public.current_couple_event_ids())
     )
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_cancelled_at
    INTO v_state, v_cancelled_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested');
  END IF;

  IF v_state = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'already', 'cancelled_at', v_cancelled_at);
  END IF;

  -- Too late: the vendor already answered. Undo only reaches an unanswered ask.
  -- Unwinding an agreed lock is the existing revert-to-considering path, not
  -- this one, and unwinding a decline is meaningless.
  IF v_state IN ('agreed', 'declined', 'expired') THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_state);
  END IF;

  UPDATE public.event_vendors
     SET lock_request_state        = 'cancelled',
         lock_request_cancelled_at = NOW(),
         updated_at                = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND lock_request_state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT lock_request_state INTO v_state
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object('status', 'already', 'current', v_state);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'cancelled_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_vendor_lock_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_vendor_lock_request(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_vendor_lock_request(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_vendor_lock_request(UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_vendor_lock_request(UUID) IS
  'PR-H Undo: the COUPLE withdraws their own still-pending lock request. Single-winner (FOR UPDATE + pending precondition in the WHERE), idempotent on re-call. Gated to current_couple_event_ids() or admin — deliberately NOT couple-or-coordinator, mirroring the 20271016300000 narrowing that stopped a coordinator answering their own ask. Once the vendor has agreed or declined, this refuses; unwinding a live booking is the separate revert path.';

REVOKE ALL ON FUNCTION public.guard_event_vendor_lock_handshake()
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8 · RLS — unchanged, and that is the decision, not an omission.
--
--     No new table is created, so there is no new default-open relation to
--     REVOKE (supabase/security/README.md:36-37). event_vendors already has RLS
--     enabled with the couple-write / vendor-read policies it shipped with; this
--     migration widens NO policy. The vendor's read of a pending request runs
--     the way the vendor Overview already reads this table — the service_role
--     admin client scoped to the caller's own vendor_profile_id
--     (apps/web/lib/vendor-overview.ts:44-49, :469-497) — precisely so a vendor
--     SELECT policy on event_vendors is not opened, which would hand vendors the
--     couple's whole booking row including budget figures.
--
--     The three RPCs above are the ONLY write path to the vendor's answer, they
--     each gate ownership themselves, and each is REVOKEd from anon so none of
--     them lands on the anon-RPC surface baseline.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 9 · Post-conditions — RAISE unless everything claimed above actually exists.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  missing_col   TEXT;
  missing_con   TEXT;
  fn            TEXT;
  leaked        TEXT;
BEGIN
  -- 9a · the nine columns
  FOREACH missing_col IN ARRAY ARRAY[
    'lock_requested_at', 'lock_requested_by_user_id', 'lock_request_expires_at',
    'lock_request_state', 'lock_agreed_at', 'lock_declined_at',
    'lock_decline_reason', 'lock_answered_by_user_id', 'lock_request_cancelled_at'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'event_vendors'
         AND column_name  = missing_col
    ) THEN
      RAISE EXCEPTION
        'post-condition failed: public.event_vendors.% was not created', missing_col;
    END IF;
  END LOOP;

  -- 9b · event_vendors.status was NOT touched — the 6 enum labels are intact.
  IF (SELECT count(*) FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'vendor_status') <> 6 THEN
    RAISE EXCEPTION
      'post-condition failed: public.vendor_status no longer has exactly 6 labels — this migration must never touch the status ladder';
  END IF;

  -- 9c · the four constraints
  FOREACH missing_con IN ARRAY ARRAY[
    'event_vendors_lock_request_state_chk',
    'event_vendors_lock_request_marketplace_chk',
    'event_vendors_lock_request_coherence_chk',
    'event_vendors_lock_decline_reason_chk'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.event_vendors'::regclass
         AND conname  = missing_con
    ) THEN
      RAISE EXCEPTION 'post-condition failed: constraint % is missing', missing_con;
    END IF;
  END LOOP;

  -- 9d · the one-live-request index exists AND is actually UNIQUE and PARTIAL.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'event_vendors_one_pending_lock_request_uniq'
       AND i.indisunique
       AND i.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: event_vendors_one_pending_lock_request_uniq is missing, not unique, or not partial — one-live-request-per-(event,vendor) would fall back to app code';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'event_vendors_pending_lock_request_idx'
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: event_vendors_pending_lock_request_idx is missing';
  END IF;

  -- 9e · the forgery/expiry trigger is attached
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'event_vendors'
       AND t.tgname  = 'event_vendors_guard_lock_handshake'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: trigger event_vendors_guard_lock_handshake is missing — lock_agreed_at would be couple-forgeable through the table-wide UPDATE grant';
  END IF;

  -- 9f · the deposit guard this one sits beside is still attached (we must not
  --      have displaced it).
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'event_vendors'
       AND t.tgname  = 'event_vendors_guard_deposit_ack'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: the pre-existing event_vendors_guard_deposit_ack trigger is gone';
  END IF;

  -- 9g · the three RPCs exist, are SECURITY DEFINER, and pin search_path
  FOREACH fn IN ARRAY ARRAY[
    'vendor_agree_to_lock', 'vendor_decline_lock', 'cancel_vendor_lock_request'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = fn
         AND p.prosecdef
         AND EXISTS (
           SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) cfg
            WHERE cfg = 'search_path=public'
         )
    ) THEN
      RAISE EXCEPTION
        'post-condition failed: public.%() is missing, is not SECURITY DEFINER, or does not pin search_path', fn;
    END IF;
  END LOOP;

  -- 9h · none of the three leaked EXECUTE to anon or PUBLIC
  SELECT string_agg(p.proname, ', ') INTO leaked
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('vendor_agree_to_lock', 'vendor_decline_lock',
                       'cancel_vendor_lock_request',
                       'guard_event_vendor_lock_handshake')
     AND (has_function_privilege('anon',   p.oid, 'EXECUTE')
       OR has_function_privilege('public', p.oid, 'EXECUTE'));
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'post-condition failed: anon/PUBLIC still hold EXECUTE on: %', leaked;
  END IF;

  -- 9i · authenticated CAN call the three intended RPCs (a REVOKE that
  --      over-reached would ship a dead feature, silently).
  FOREACH fn IN ARRAY ARRAY[
    'vendor_agree_to_lock', 'vendor_decline_lock', 'cancel_vendor_lock_request'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = fn
         AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) THEN
      RAISE EXCEPTION
        'post-condition failed: authenticated cannot EXECUTE public.%() — the RPC would be unreachable', fn;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
