-- A LOCKED GIFT CANNOT MOVE (SUP-I).
--
-- ⚖ OWNER, 2026-09-15, asked what exactly should freeze when a couple locks:
--   **BOTH the promise and the number.**
-- ⚖ OWNER, 2026-09-16, asked WHICH moment freezes it, given locking is two steps:
--   **"both. the supplier needs to pay us before this becomes true."**
--
-- So: the promise is recorded when the couple ASKS, confirmed when the supplier
-- AGREES, and immutable from then on — while DELIVERY still waits for the money,
-- exactly as it already did. Nothing here grants a credit earlier.
--
-- ── WHY THIS NEEDED COLUMNS AND NOT A TRIGGER TWEAK ─────────────────────────
-- Measured against the LIVE trigger body in production (pg_get_functiondef,
-- 2026-09-16 — not the migration file):
--   · `setnayan_gift_offered` (the yes/no) IS already frozen: it is assigned only
--     under `IF TG_OP = 'INSERT'`, else `NEW.x = OLD.x`.
--   · `gift_credits` / `gift_centavos` are RE-DERIVED from the live catalogue on
--     EVERY update that leaves the row `status='pending'`, and freeze only at
--     `status='paid'`. So the NUMBER genuinely could move after a lock.
--
-- 🔑 BUT THE DEEPER REASON: **at lock there is no row to freeze onto.** The
-- sequence is couple asks → supplier agrees (status→contracted) → couple records
-- a deposit → supplier ACKNOWLEDGES it → and only THEN does
-- `booking_fee_open_lock_charge` INSERT the charge that carries the gift. The gap
-- after the supplier's yes is UNBOUNDED: the only clock in the chain is the 48h
-- fuse on the ask. A freeze written into the charge trigger would freeze a value
-- that did not exist at the moment the couple was promised it.
--
-- The promise therefore lives on `event_vendors`, which exists from the ask.
--
-- ── AND THE BASIS IS STORED, NOT JUST THE ANSWER ───────────────────────────
-- ⚖ Project rule: a number about money must have a traceable source or not ship.
-- A frozen count with no recorded basis is an unsourced number six months later,
-- so `..._fee_basis_centavos` records the fee the 40% was taken of. This mirrors
-- `papic_limited_snapshots`, which stores `guest_count` / `rate_php` / `cap_php`
-- beside its frozen figure for exactly this reason.
--
-- ⚠ AUDITABLE DOWN TO THE FEE, NOT THE RUNG. The ladder is interpolated from
-- `platform_retail_catalog_v2`; a later reprice of a rung cannot change a frozen
-- number (that is the point) but does mean the stamp cannot be re-derived from
-- today's catalogue. Stated rather than hidden.
--
-- ── SCOPE HONESTY ──────────────────────────────────────────────────────────
-- ⚠ This whole path has NEVER EXECUTED in production. Measured 2026-09-16:
-- 48 event_vendors · 0 lock handshakes ever · 0 deposits recorded · 0
-- booking_fee_charges · 0 ledger rows · 0 service cards with the gift switched
-- on. Every behaviour below is therefore UNEXERCISED, not proven, and the db
-- tests are the only thing that has ever run it.
--
-- Idempotent: IF NOT EXISTS columns, CREATE OR REPLACE functions, DROP/CREATE
-- trigger. No data is written to existing rows — a NULL `locked_at` means
-- "stamped before SUP-I existed" and every reader falls back to live derivation.

-- ── 1) THE STAMP ───────────────────────────────────────────────────────────
-- ⚠ ONE ALTER PER COLUMN, DELIBERATELY. `exposure-freeze.db.test.ts` reads only
-- the FIRST column of a multi-column ALTER, so a combined statement would hide
-- the rest from the exposure baseline.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS setnayan_gift_locked_at TIMESTAMPTZ;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS setnayan_gift_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS setnayan_gift_offered_at_lock BOOLEAN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS setnayan_gift_credits_at_lock INTEGER;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS setnayan_gift_centavos_at_lock BIGINT;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS setnayan_gift_fee_basis_centavos BIGINT;

COMMENT ON COLUMN public.event_vendors.setnayan_gift_locked_at IS
  'When the COUPLE asked to lock, and the gift promise was first recorded. NULL = '
  'no promise recorded (pre-SUP-I row, or never locked) and every reader falls '
  'back to live derivation. Written only by stamp_setnayan_gift_at_lock().';
COMMENT ON COLUMN public.event_vendors.setnayan_gift_confirmed_at IS
  'When the SUPPLIER agreed. From this moment the four value columns are '
  'IMMUTABLE — guard_setnayan_gift_stamp refuses any change, from any caller.';
COMMENT ON COLUMN public.event_vendors.setnayan_gift_fee_basis_centavos IS
  'The booking fee the 40% was taken of. Stored so a frozen count keeps a '
  'traceable source; auditable down to the fee, not to the ladder rung.';

-- ── 2) STAMPING IT ─────────────────────────────────────────────────────────
-- Called at BOTH lock moments (owner: "both"). The first call records; the
-- second confirms.
--
-- 🔑 WHEN THE TWO DISAGREE, THE COUPLE KEEPS THE BETTER NUMBER. Between the ask
-- and the supplier's yes the price can move, and with it the fee and the gift.
-- The couple was shown a figure at the moment they committed; taking it away
-- because a renegotiation shrank the fee would make the promise worthless
-- exactly when it matters. Raising it costs the supplier more than they saw —
-- so the SUPPLIER'S CHARGE is taken from the same winning stamp, never split
-- across the two. One pair of numbers, chosen once.
CREATE OR REPLACE FUNCTION public.stamp_setnayan_gift_at_lock(
  p_event_vendor_id UUID,
  p_confirm BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev            RECORD;
  v_offered       BOOLEAN;
  v_fee_centavos  BIGINT;
  -- ⚠ SEPARATE SCALARS, NOT A RECORD. A first cut used `v_gift RECORD` and
  -- assigned `ROW(0, 0)` on the no-gift path — an ANONYMOUS record whose fields
  -- have no names, so the very next `v_gift.credits` raised 42703. It failed
  -- only on the branch where the card says NO, which is the branch nothing in
  -- production would have exercised for months.
  v_credits       INTEGER := 0;
  v_centavos      BIGINT  := 0;
BEGIN
  SELECT ev.vendor_id, ev.total_cost_php, ev.setnayan_gift_confirmed_at,
         ev.setnayan_gift_credits_at_lock, ev.setnayan_gift_centavos_at_lock,
         ev.setnayan_gift_offered_at_lock, ev.setnayan_gift_locked_at
    INTO v_ev
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Already confirmed ⇒ immutable. Silently done, not an error: both writers
  -- call this and a re-run must never raise on a supplier pressing yes twice.
  IF v_ev.setnayan_gift_confirmed_at IS NOT NULL THEN RETURN; END IF;

  -- ⚠ NOT `setnayan_gift_offered_on(vendor_id)` FROM A BEFORE TRIGGER — this is
  -- an ordinary function called AFTER the row is written, so the read is the
  -- post-image and the join is sound. (Called from a BEFORE trigger the same
  -- helper reads the PRE-image and answers FALSE for every insert.)
  v_offered := public.setnayan_gift_offered_on(p_event_vendor_id);

  v_fee_centavos := public.booking_fee_centavos(
    ROUND(COALESCE(v_ev.total_cost_php, 0) * 100)::BIGINT
  );

  IF v_offered AND COALESCE(v_fee_centavos, 0) > 0 THEN
    SELECT COALESCE(g.credits, 0), COALESCE(g.charge_centavos, 0)
      INTO v_credits, v_centavos
      FROM public.setnayan_gift_for_fee(v_fee_centavos) g;
  END IF;

  UPDATE public.event_vendors ev
     SET setnayan_gift_locked_at = COALESCE(ev.setnayan_gift_locked_at, NOW()),
         setnayan_gift_confirmed_at = CASE WHEN p_confirm THEN NOW() ELSE ev.setnayan_gift_confirmed_at END,
         -- The couple keeps the better promise; the supplier's charge rides
         -- with it, so the pair never splits across two stamps.
         setnayan_gift_offered_at_lock =
           COALESCE(ev.setnayan_gift_offered_at_lock, FALSE) OR COALESCE(v_offered, FALSE),
         setnayan_gift_credits_at_lock =
           GREATEST(COALESCE(ev.setnayan_gift_credits_at_lock, 0), v_credits),
         setnayan_gift_centavos_at_lock =
           CASE
             WHEN v_credits >= COALESCE(ev.setnayan_gift_credits_at_lock, 0)
               THEN v_centavos
             ELSE ev.setnayan_gift_centavos_at_lock
           END,
         setnayan_gift_fee_basis_centavos =
           CASE
             WHEN v_credits >= COALESCE(ev.setnayan_gift_credits_at_lock, 0)
               THEN v_fee_centavos
             ELSE ev.setnayan_gift_fee_basis_centavos
           END
   WHERE ev.vendor_id = p_event_vendor_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stamp_setnayan_gift_at_lock(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stamp_setnayan_gift_at_lock(UUID, BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.stamp_setnayan_gift_at_lock(UUID, BOOLEAN) TO service_role;

-- ── 3) NOBODY MAY FORGE OR MOVE IT ─────────────────────────────────────────
-- 🔴 `event_vendors_couple_write` is `ALL` for `authenticated` with NO column
-- list, so every column above is PostgREST-writable by the couple unless fenced.
-- A couple could otherwise POST themselves 50,000 photographs.
--
-- Two tiers, because they are different wrongs:
--   · authenticated / anon writing these columns at all → 42501, always;
--   · ANY caller (service_role included) changing a CONFIRMED value → refused.
CREATE OR REPLACE FUNCTION public.guard_setnayan_gift_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_touched BOOLEAN;
BEGIN
  v_touched :=
       NEW.setnayan_gift_locked_at          IS DISTINCT FROM OLD.setnayan_gift_locked_at
    OR NEW.setnayan_gift_confirmed_at       IS DISTINCT FROM OLD.setnayan_gift_confirmed_at
    OR NEW.setnayan_gift_offered_at_lock    IS DISTINCT FROM OLD.setnayan_gift_offered_at_lock
    OR NEW.setnayan_gift_credits_at_lock    IS DISTINCT FROM OLD.setnayan_gift_credits_at_lock
    OR NEW.setnayan_gift_centavos_at_lock   IS DISTINCT FROM OLD.setnayan_gift_centavos_at_lock
    OR NEW.setnayan_gift_fee_basis_centavos IS DISTINCT FROM OLD.setnayan_gift_fee_basis_centavos;

  IF NOT v_touched THEN RETURN NEW; END IF;

  IF current_setting('role', TRUE) IN ('authenticated', 'anon')
     OR current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'the Setnayan gift stamp is written by the platform, not by a client'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.setnayan_gift_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'this gift was confirmed at % and cannot be changed', OLD.setnayan_gift_confirmed_at
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 🔒 NOBODY MAY CALL IT DIRECTLY. A new SECURITY DEFINER function inherits
-- EXECUTE for anon and authenticated, and `anon` is any holder of the
-- publishable key that ships in the public JavaScript bundle. This one is a
-- trigger body, so a direct call would raise 0A000 anyway — but the repo's own
-- rule is that the GRANT decides who may call a function, never the caller the
-- author had in mind, and an unusable grant is still surface. Revoked rather
-- than written into tests/db/anon-rpc-surface.baseline.txt: that file says the
-- count SHOULD SHRINK, and a line there records a grant nobody can justify.
--
-- ⚠ THIS DOES NOT DISARM THE TRIGGER. PostgreSQL checks EXECUTE on a trigger
-- function when the TRIGGER IS CREATED, not each time it fires; the fire path
-- runs as the table owner. Proven, not assumed — `a-locked-gift-cannot-move`'s
-- own db test still refuses a confirmed gift after this revoke, and that test
-- can only pass if the trigger still runs.
REVOKE EXECUTE ON FUNCTION public.guard_setnayan_gift_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_setnayan_gift_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_setnayan_gift_stamp() FROM authenticated;

DROP TRIGGER IF EXISTS guard_setnayan_gift_stamp ON public.event_vendors;
CREATE TRIGGER guard_setnayan_gift_stamp
  BEFORE UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_setnayan_gift_stamp();

-- ── 4) THE CHARGE HONOURS THE PROMISE ──────────────────────────────────────
-- The whole point. `booking_fee_charges_size_the_gift` re-derived the number
-- from the live catalogue on every pending update; now, when the booking carries
-- a stamp, it USES the stamp instead.
--
-- ⚠ EVERY OTHER BRANCH IS BYTE-IDENTICAL to the deployed body (read from prod
-- 2026-09-16). The only change is the stamped branch and the fallback comment —
-- an unstamped booking behaves exactly as it does today, so no existing row's
-- behaviour moves.
CREATE OR REPLACE FUNCTION public.booking_fee_charges_size_the_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift  RECORD;
  v_stamp RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.setnayan_gift_offered =
      NEW.kind = 'primary'
      AND NEW.source = 'lock'
      AND NEW.event_vendor_id IS NOT NULL
      AND public.setnayan_gift_offered_on(NEW.event_vendor_id);
  ELSE
    NEW.setnayan_gift_offered = OLD.setnayan_gift_offered;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status = 'paid' THEN
    NEW.gift_credits  := OLD.gift_credits;
    NEW.gift_centavos := OLD.gift_centavos;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'paid'
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN
    NEW.gift_credits  := OLD.gift_credits;
    NEW.gift_centavos := OLD.gift_centavos;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending'
     AND NEW.setnayan_gift_offered
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN

    -- ⚖ THE PROMISE WINS. Owner 2026-09-15/16: the gift is frozen at lock, both
    -- the yes/no and the number. A stamped booking is billed and granted what
    -- the couple was actually promised, whatever the catalogue says now.
    IF NEW.event_vendor_id IS NOT NULL THEN
      SELECT ev.setnayan_gift_locked_at,
             ev.setnayan_gift_credits_at_lock,
             ev.setnayan_gift_centavos_at_lock
        INTO v_stamp
        FROM public.event_vendors ev
       WHERE ev.vendor_id = NEW.event_vendor_id;

      IF v_stamp.setnayan_gift_locked_at IS NOT NULL
         AND COALESCE(v_stamp.setnayan_gift_credits_at_lock, 0) > 0 THEN
        NEW.gift_credits  := v_stamp.setnayan_gift_credits_at_lock;
        NEW.gift_centavos := COALESCE(v_stamp.setnayan_gift_centavos_at_lock, 0);
        RETURN NEW;
      END IF;
    END IF;

    -- No stamp (a booking older than SUP-I, or one that never went through a
    -- lock): behave exactly as before — size it on the live fee.
    SELECT g.credits, g.charge_centavos INTO v_gift
      FROM public.setnayan_gift_for_fee(NEW.amount_charged_centavos) g;
    NEW.gift_credits  := COALESCE(v_gift.credits, 0);
    NEW.gift_centavos := COALESCE(v_gift.charge_centavos, 0);
    RETURN NEW;
  END IF;

  NEW.gift_credits  := 0;
  NEW.gift_centavos := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_fee_charges_size_the_gift ON public.booking_fee_charges;
CREATE TRIGGER booking_fee_charges_size_the_gift
  BEFORE INSERT OR UPDATE ON public.booking_fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_charges_size_the_gift();
