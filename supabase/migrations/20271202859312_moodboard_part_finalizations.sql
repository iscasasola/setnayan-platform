-- ============================================================================
-- 20271202859312_moodboard_part_finalizations.sql
--
-- MB12 — THE PER-PART FINALIZATION HANDSHAKE. "A part the vendor has agreed to
-- build stops moving."
--
-- ── ONE VOCABULARY, A SECOND SCOPE. NOT A SECOND MECHANISM. ────────────────
-- `event_vendors.lock_request_state` (20271107090000) is the booking handshake:
-- five values — pending · agreed · declined · cancelled · expired — a 48-hour
-- fuse materialised by a trigger, lazy expiry on the answer path, and
-- SECURITY DEFINER single-winner RPCs for the vendor's answer. This table is
-- THAT MACHINE at a new scope: (event, part, vendor) instead of (booking).
-- Same five values, same fuse, same idioms, so the app can read both through
-- `apps/web/lib/lock-request-state.ts` and cannot end up with two mechanisms
-- that disagree about one fact.
--
-- 🛑 ONE DELIBERATE DIFFERENCE, AND IT IS AN OWNER RULING (2026-09-04).
-- `lockRequestStateOf` returns `locked` for ANY confirmed booking — "a real
-- booking outranks any marker". FINALIZATION DOES NOT INHERIT THAT. A confirmed
-- booking means the supplier is hired; it does not mean they reviewed and
-- agreed to THIS design. Auto-finalizing a part from a booking alone would
-- fabricate the exact agreement this handshake exists to capture. So nothing
-- here ever reads `event_vendors.status` to decide whether a part is finalized
-- — status is consulted for ONE thing only, whether the supplier is booked at
-- all, which is a precondition on ASKING, never an answer.
--
-- ── WHAT ONE ROW HOLDS ─────────────────────────────────────────────────────
--   which part (part_id, the derived namespaced registry id)
--   which booked supplier is being asked (vendor_id → event_vendors)
--   the design they are answering (design_snapshot)
--   the handshake (state + its five timestamps + the vendor's own words)
--   the COUNTER-handshake that can undo it (reopen_state + its own fuse)
--   what the agreement actually FROZE (frozen_palette_keys, frozen_dressing_fields)
--
-- ── THE FREEZE AND THE FINALIZATION ARE ONE TRANSACTION ────────────────────
-- 🔑 THIS IS THE WIRING, AND IT IS THE POINT OF THE WHOLE FILE.
-- "A finalized part stops re-deriving from 00" is not a second feature bolted
-- to the side of the handshake — it is what agreeing MEANS. Two seams exist if
-- they are separate writes:
--
--   · the row says `agreed` and nothing froze → the couple changes their five
--     majors and the supplier's agreed design silently becomes a different
--     design. Nothing renders differently. The supplier builds what they agreed
--     to and it is wrong on the day.
--   · the palette froze and no row says `agreed` → a role stops following the
--     majors for no reason anybody can name, and no surface can explain why.
--
-- `vendor_agree_to_part` therefore does BOTH IN ONE FUNCTION BODY, i.e. one
-- transaction: it flips the row to `agreed` AND writes the snapshot's colours
-- into `events.role_palette` — into `touched_roles` and `room_dressing`, the
-- two derivation-stops MB5 already ships — in the same statement pair. Neither
-- half is reachable alone. `vendor_answer_part_reopen` welds the release the
-- same way. See tests/db/a-finalized-part-and-its-freeze-are-one-transaction.db.test.ts.
--
-- 🔑 AND THE FREEZE REUSES MB5, IT DOES NOT PARALLEL IT. `touched_roles` is
-- already "the couple edited this role, so never overwrite it"
-- (lib/palette-styles.ts: `if (touchedRoles.has(key)) continue`). An agreed part
-- makes the DERIVED colour an EXPLICIT one — exactly what a couple's own edit
-- does — so the existing stop applies with no new branch anywhere in the
-- engine. `room_dressing` works the same way: `resolveRoomDressing` already
-- honours an explicit override over the derived value.
--
-- ⚠ `frozen_palette_keys` / `frozen_dressing_fields` record what THIS agreement
-- added, not everything now frozen. A couple who hand-edited `bride` before
-- finalizing keeps that edit when the part is re-opened; releasing "every key
-- in the snapshot" would silently discard a choice the couple made themselves.
--
-- ── AT MOST ONE LIVE HANDSHAKE PER PART ────────────────────────────────────
-- `moodboard_part_finalizations_one_live_uniq` is a partial UNIQUE index over
-- (event_id, part_id) WHERE state IN ('pending','agreed'). A part is ONE design;
-- two suppliers agreeing to it separately would make "is this part frozen"
-- answerable two ways, which is the drift this file exists to avoid. Closed
-- rows (declined / cancelled / expired) accumulate as history and do not
-- occupy the slot, so a couple can always ask again — including asking somebody
-- else after a decline.
--
-- ── NO AUTHENTICATED WRITE PATH AT ALL ─────────────────────────────────────
-- There is no INSERT/UPDATE/DELETE policy for `authenticated`. Every transition
-- is a SECURITY DEFINER RPC, so "finalize with no booked vendor" is not merely
-- refused by a server action — the row cannot come into existence any other
-- way. `request_part_finalization` re-checks CONFIRMED status inside the
-- function, so bypassing the UI and calling the RPC directly is refused too.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. The pipeline pushes the
-- committed file; a direct apply orphans the prod ledger and jams `db push` for
-- every subsequent merge.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.moodboard_part_finalizations (
  finalization_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id              UUID NOT NULL
                          REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- WHICH PART. Same namespaced vocabulary and the same SHAPE-not-list CHECK as
  -- event_renders.part_id — the registry is DERIVED at runtime in
  -- apps/web/lib/moodboard-render-parts.ts, and a list here would go stale the
  -- first time a zone is added.
  --
  -- 🔑 `whole_look` IS DELIBERATELY EXCLUDED, unlike on event_renders. A render
  -- of the whole look is one picture; an AGREEMENT to the whole look is not
  -- anybody's job — no single supplier builds the ceiling and the gowns and the
  -- cake. Asking one of them to agree to all of it would produce a signature
  -- against work they never do.
  part_id               TEXT NOT NULL
                          CONSTRAINT moodboard_part_finalizations_part_id_shape
                          CHECK (part_id ~ '^(room|people|place):[a-z0-9_]+$'),

  -- The BOOKING being asked, not the shop. event_vendors.vendor_id IS that
  -- table's UUID primary key (20260513100000) — the same column
  -- vendor_agree_to_lock takes. CASCADE: if the couple removes the booking, the
  -- question they asked it goes with it.
  vendor_id             UUID NOT NULL
                          REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,

  -- ── the handshake ────────────────────────────────────────────────────────
  -- The five values of event_vendors.lock_request_state, unchanged. NULL is not
  -- a member here: a row only exists because somebody asked, so the "never
  -- asked" state is the ABSENCE of a row. lib/lock-request-state.ts maps that
  -- absence to 'none', which is the same answer the booking handshake gives.
  state                 TEXT NOT NULL DEFAULT 'pending'
                          CONSTRAINT moodboard_part_finalizations_state_chk
                          CHECK (state IN ('pending','agreed','declined','cancelled','expired')),

  -- The design the supplier is answering. A finalization is an agreement about
  -- a SPECIFIC set of colours, and the couple can keep editing while the
  -- request is open — so what was asked has to be recorded, not re-derived
  -- later from a board that has moved. Shape:
  --   { "palette": { "<PaletteKey>": ["#RRGGBB", …] },
  --     "room_dressing": { "linens": "#RRGGBB", … } }
  design_snapshot       JSONB NOT NULL,

  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The couple who asked. SET NULL, not CASCADE: the agreement belongs to the
  -- EVENT and must survive a co-partner deleting their account (erasure rule
  -- G6 — SET NULL ⇒ an actor stamp, the row survives).
  requested_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,

  -- MATERIALIZED 48-hour deadline, stamped by the trigger below on every
  -- transition INTO 'pending'. Materialized for the same reason
  -- lock_request_expires_at is: the number shown is the number enforced, and a
  -- re-ask gets a fresh fuse rather than inheriting a dead one.
  expires_at            TIMESTAMPTZ,

  agreed_at             TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  -- The supplier's own words. <= 240 chars, matching lock_decline_reason: a
  -- design a supplier could not build must still be able to say why, six months
  -- later, when the couple is choosing somebody else.
  decline_reason        TEXT
                          CONSTRAINT moodboard_part_finalizations_decline_reason_len
                          CHECK (decline_reason IS NULL OR length(decline_reason) <= 240),
  answered_by_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  cancelled_at          TIMESTAMPTZ,

  -- ── the COUNTER-handshake ────────────────────────────────────────────────
  -- 🔑 RE-OPEN IS NOT A BUTTON, IT IS THE SAME MACHINE POINTED THE OTHER WAY.
  -- If the couple could un-finalize alone, "agreed" would mean nothing: the
  -- supplier would be building against a design that can change without them
  -- ever hearing. So a finalized part is re-opened only when the SUPPLIER
  -- agrees to re-open it — the same five values, the same 48-hour fuse, the
  -- same lazy expiry, on the same row.
  reopen_state          TEXT
                          CONSTRAINT moodboard_part_finalizations_reopen_state_chk
                          CHECK (reopen_state IS NULL
                                 OR reopen_state IN ('pending','agreed','declined','cancelled','expired')),
  reopen_requested_at   TIMESTAMPTZ,
  reopen_requested_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reopen_expires_at     TIMESTAMPTZ,
  reopen_answered_at    TIMESTAMPTZ,
  reopen_answered_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reopen_decline_reason TEXT
                          CONSTRAINT moodboard_part_finalizations_reopen_reason_len
                          CHECK (reopen_decline_reason IS NULL OR length(reopen_decline_reason) <= 240),

  -- ── what the agreement actually froze ────────────────────────────────────
  -- Written by vendor_agree_to_part, read by vendor_answer_part_reopen. These
  -- are the keys/fields THIS agreement ADDED to events.role_palette — never
  -- everything the snapshot mentions. See the header.
  frozen_palette_keys    TEXT[] NOT NULL DEFAULT '{}',
  frozen_dressing_fields TEXT[] NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Coherence: the receipts must agree with the machine. A row saying 'agreed'
  -- with no agreed_at is a row nothing can date, and every countdown, digest
  -- and audit that reads it would quietly report NULL.
  CONSTRAINT moodboard_part_finalizations_answer_coherent
    CHECK (
      (state <> 'agreed'   OR agreed_at   IS NOT NULL)
      AND (state <> 'declined'  OR declined_at  IS NOT NULL)
      AND (state <> 'cancelled' OR cancelled_at IS NOT NULL)
    ),
  -- A re-open can only exist on a part that was finalized in the first place.
  CONSTRAINT moodboard_part_finalizations_reopen_needs_agreement
    CHECK (reopen_state IS NULL OR agreed_at IS NOT NULL)
);

COMMENT ON TABLE public.moodboard_part_finalizations IS
  'MB12. One row per (event, part, vendor) finalization handshake on the Mood '
  'Board. Reuses event_vendors.lock_request_state''s five-value vocabulary and '
  'its 48-hour fuse at a new scope — never a second mechanism. state=''agreed'' '
  'means the supplier reviewed and agreed to THIS design; it is NEVER inferred '
  'from event_vendors.status (owner ruling 2026-09-04). Agreeing freezes the '
  'snapshot into events.role_palette in the SAME transaction, so a finalized '
  'part cannot re-derive from the couple''s majors.';

COMMENT ON COLUMN public.moodboard_part_finalizations.state IS
  'pending = asked, awaiting the supplier; agreed = the supplier said yes and '
  'the design is frozen; declined = the supplier said no; cancelled = the couple '
  'withdrew, OR the supplier agreed to re-open (see reopen_state); expired = '
  'nobody answered inside 48 hours. Flipped ONLY by the SECURITY DEFINER RPCs '
  'in this file. There is no NULL member: a row exists because somebody asked.';

COMMENT ON COLUMN public.moodboard_part_finalizations.design_snapshot IS
  'The colours the supplier is answering — { palette: { <PaletteKey>: [hex] }, '
  'room_dressing: { <field>: hex } }. Recorded at ASK time because the couple '
  'may keep editing while the request is open; vendor_agree_to_part writes THIS, '
  'not whatever the board says at answer time.';

COMMENT ON COLUMN public.moodboard_part_finalizations.frozen_palette_keys IS
  'The role_palette.touched_roles keys THIS agreement added. Not every key in '
  'the snapshot: a role the couple had already touched by hand stays theirs, and '
  'a re-open must not release it.';

COMMENT ON COLUMN public.moodboard_part_finalizations.reopen_state IS
  'The COUNTER-handshake. A finalized part is released only when the supplier '
  'agrees to release it — same five values, same 48-hour fuse. reopen_state = '
  '''agreed'' is the one path that moves state back off ''agreed'' (to '
  '''cancelled''), and it releases frozen_palette_keys / frozen_dressing_fields '
  'in the same transaction.';

-- ---- indexes --------------------------------------------------------------

-- 🔑 ONE LIVE HANDSHAKE PER PART. See the header. Partial, so closed rows pile
-- up as history and never block a re-ask.
CREATE UNIQUE INDEX IF NOT EXISTS moodboard_part_finalizations_one_live_uniq
  ON public.moodboard_part_finalizations (event_id, part_id)
  WHERE state IN ('pending', 'agreed');

-- The couple's board reads every part's state in one query.
CREATE INDEX IF NOT EXISTS moodboard_part_finalizations_event_idx
  ON public.moodboard_part_finalizations (event_id, state);

-- The supplier's Answers Desk reads "what am I being asked?" by booking.
CREATE INDEX IF NOT EXISTS moodboard_part_finalizations_vendor_idx
  ON public.moodboard_part_finalizations (vendor_id, state);

-- ---- the fuse, materialized (mirrors guard_event_vendor_lock_handshake) ----

CREATE OR REPLACE FUNCTION public.guard_moodboard_part_finalization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $guard$
BEGIN
  -- 48 HOURS — the same window as the booking ask, and the same reason it is
  -- materialized rather than derived: the number a person is shown must be the
  -- number that is enforced, and a re-ask must get a FRESH fuse instead of
  -- inheriting the dead deadline of the round before (the bug the booking
  -- handshake shipped with). Keyed on the TRANSITION into pending, so a later
  -- touch of an already-pending row never silently extends the window.
  IF NEW.state = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.state IS DISTINCT FROM 'pending')
  THEN
    NEW.expires_at := COALESCE(NEW.requested_at, NOW()) + INTERVAL '48 hours';
  END IF;

  IF NEW.reopen_state = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.reopen_state IS DISTINCT FROM 'pending')
  THEN
    NEW.reopen_expires_at := COALESCE(NEW.reopen_requested_at, NOW()) + INTERVAL '48 hours';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS moodboard_part_finalizations_guard ON public.moodboard_part_finalizations;
CREATE TRIGGER moodboard_part_finalizations_guard
  BEFORE INSERT OR UPDATE ON public.moodboard_part_finalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_moodboard_part_finalization();

COMMENT ON FUNCTION public.guard_moodboard_part_finalization() IS
  'Materializes the 48-hour answer window onto expires_at / reopen_expires_at on '
  'every transition INTO pending, so the deadline is stored once instead of '
  'hand-typed into every reader, and a re-ask never inherits a dead fuse. '
  'Mirrors guard_event_vendor_lock_handshake. No forgery clause is needed here: '
  'this table grants authenticated NO write at all — every transition is a '
  'SECURITY DEFINER RPC.';

-- ---- THE BACKSTOP: no writer anywhere can drop a freeze -------------------
--
-- 🔑 THE SEAM THIS CLOSES. `events.role_palette` is written by more than one
-- path — the board's debounced save, applying a theme template, the onboarding
-- wizard, an admin repair. Each of them replaces the whole JSONB blob. Any one
-- of them that does not know about finalization would silently drop
-- `touched_roles` entries and `room_dressing` overrides that a supplier agreed
-- to, and NOTHING WOULD RENDER DIFFERENTLY: the part would simply start
-- following the couple's majors again, which is what it looked like before it
-- was ever finalized. A guard on ONE writer is a guard on one writer.
--
-- So the freeze is re-asserted in the DATABASE, on every write, from every
-- path. A part that has been agreed cannot be un-frozen by forgetting.
--
-- ⚠ IT RESTORES THE VALUES, NOT ONLY THE MARKERS. Putting a key back into
-- touched_roles while letting its colours be overwritten would freeze a role at
-- whatever the last writer happened to say — which is not what the supplier
-- agreed to. The snapshot is the agreement.
--
-- ⚠ CONSEQUENCE, ON PURPOSE: while a part is finalized its colours are not
-- editable by anyone. The couple's own controls are disabled on those roles
-- (see the UI), so nobody experiences a value snapping back; a script or a
-- second surface that tried would find the write simply does not take.
CREATE OR REPLACE FUNCTION public.reassert_part_finalization_freeze(
  p_event_id UUID,
  p_palette  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $reassert$
DECLARE
  v_palette JSONB := COALESCE(p_palette, '{}'::jsonb);
  v_touched JSONB;
  v_set     TEXT[];
  v_rd      JSONB;
  v_row     RECORD;
  v_key     TEXT;
BEGIN
  v_touched := COALESCE(v_palette -> 'touched_roles', '[]'::jsonb);
  IF jsonb_typeof(v_touched) <> 'array' THEN v_touched := '[]'::jsonb; END IF;
  SELECT COALESCE(array_agg(DISTINCT e #>> '{}'), '{}') INTO v_set
    FROM jsonb_array_elements(v_touched) AS e;

  v_rd := COALESCE(v_palette -> 'room_dressing', '{}'::jsonb);
  IF jsonb_typeof(v_rd) <> 'object' THEN v_rd := '{}'::jsonb; END IF;

  FOR v_row IN
    SELECT design_snapshot, frozen_palette_keys, frozen_dressing_fields
      FROM public.moodboard_part_finalizations
     WHERE event_id = p_event_id
       AND state = 'agreed'
  LOOP
    FOREACH v_key IN ARRAY v_row.frozen_palette_keys LOOP
      IF (v_row.design_snapshot -> 'palette') ? v_key THEN
        v_palette := jsonb_set(
          v_palette, ARRAY[v_key], v_row.design_snapshot -> 'palette' -> v_key, TRUE);
      END IF;
      IF NOT (v_key = ANY (v_set)) THEN v_set := v_set || v_key; END IF;
    END LOOP;
    FOREACH v_key IN ARRAY v_row.frozen_dressing_fields LOOP
      IF (v_row.design_snapshot -> 'room_dressing') ? v_key THEN
        v_rd := jsonb_set(
          v_rd, ARRAY[v_key], v_row.design_snapshot -> 'room_dressing' -> v_key, TRUE);
      END IF;
    END LOOP;
  END LOOP;

  v_palette := jsonb_set(v_palette, '{touched_roles}', to_jsonb(v_set), TRUE);
  v_palette := jsonb_set(v_palette, '{room_dressing}', v_rd, TRUE);
  RETURN v_palette;
END;
$reassert$;

-- 🛑 NOT CALLABLE BY ANYBODY HOLDING THE PUBLISHABLE KEY.
-- This is SECURITY DEFINER and it reads moodboard_part_finalizations with RLS
-- bypassed, so a caller who chose its arguments could hand it any event_id and
-- read back that couple's AGREED colours and which roles are frozen. Nothing
-- about "we only call it from our own trigger" gates that — the GRANT decides,
-- not the caller. `tests/db/anon-rpc-surface.db.test.ts` caught exactly this
-- while it still had Supabase's default grant.
--
-- Its two real callers both already run as the table owner: vendor_agree_to_part
-- is SECURITY DEFINER, and the trigger function below is made SECURITY DEFINER
-- for this reason. So there is no role that needs EXECUTE at all.
REVOKE ALL ON FUNCTION public.reassert_part_finalization_freeze(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reassert_part_finalization_freeze(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.reassert_part_finalization_freeze(UUID, JSONB) FROM authenticated;

COMMENT ON FUNCTION public.reassert_part_finalization_freeze(UUID, JSONB) IS
  'MB12 backstop. Given an event and a proposed role_palette, returns it with '
  'every AGREED part''s frozen keys and colours put back — touched_roles '
  'entries, room_dressing overrides, and the snapshot values themselves. '
  'Called by the BEFORE UPDATE trigger on events, so no palette writer '
  'anywhere can drop a freeze by forgetting it exists.';

-- SECURITY DEFINER so the helper above needs no EXECUTE grant for any role —
-- see the REVOKEs. A trigger function runs as the INVOKER by default, which
-- would have meant granting `authenticated` execute on a function that reads
-- another couple's agreed colours.
CREATE OR REPLACE FUNCTION public.events_hold_part_finalization_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $hold$
BEGIN
  NEW.role_palette := public.reassert_part_finalization_freeze(NEW.event_id, NEW.role_palette);
  RETURN NEW;
END;
$hold$;

DROP TRIGGER IF EXISTS events_hold_part_finalization_freeze ON public.events;
CREATE TRIGGER events_hold_part_finalization_freeze
  BEFORE UPDATE OF role_palette ON public.events
  FOR EACH ROW
  WHEN (OLD.role_palette IS DISTINCT FROM NEW.role_palette)
  EXECUTE FUNCTION public.events_hold_part_finalization_freeze();

-- Revoked for the same reason the helper it calls is, and in the same breath:
-- it is SECURITY DEFINER, so leaving Supabase's default grant on it would put a
-- definer-privileged function on the publishable-key surface.
-- `tests/db/anon-rpc-surface.db.test.ts` flags exactly this. A trigger function
-- needs EXECUTE only at CREATE TRIGGER time — the trigger above is created by
-- the owner, one statement earlier — so firing is unaffected, which the backstop
-- test in a-finalized-part-and-its-freeze-are-one-transaction.db.test.ts proves
-- rather than assumes.
REVOKE ALL ON FUNCTION public.events_hold_part_finalization_freeze() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.events_hold_part_finalization_freeze() FROM anon;
REVOKE ALL ON FUNCTION public.events_hold_part_finalization_freeze() FROM authenticated;

COMMENT ON FUNCTION public.events_hold_part_finalization_freeze() IS
  'BEFORE UPDATE OF role_palette on events. Runs every proposed palette through '
  'reassert_part_finalization_freeze, so a finalized part cannot be un-frozen '
  'by any writer that does not know finalization exists. Fires only when '
  'role_palette actually changes.';

-- ---- RLS — Pattern B, read-only for everyone who is not a definer ---------

ALTER TABLE public.moodboard_part_finalizations ENABLE ROW LEVEL SECURITY;

-- The couple and their coordinators see every ask on their own board.
DROP POLICY IF EXISTS moodboard_part_finalizations_member_read
  ON public.moodboard_part_finalizations;
CREATE POLICY moodboard_part_finalizations_member_read
  ON public.moodboard_part_finalizations
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- The asked supplier sees the ask. Scoped to the BOOKING (not the event), so a
-- shop sees the parts it was asked about and nothing else on that board.
DROP POLICY IF EXISTS moodboard_part_finalizations_vendor_read
  ON public.moodboard_part_finalizations;
CREATE POLICY moodboard_part_finalizations_vendor_read
  ON public.moodboard_part_finalizations
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT public.current_vendor_event_vendor_ids()));

-- Admin can repair. Deliberately the ONLY non-definer write policy in the file:
-- 🛑 THERE IS NO COUPLE INSERT AND NO VENDOR UPDATE. A couple cannot manufacture
-- a supplier's agreement (the hole guard_event_vendor_lock_handshake exists to
-- close on event_vendors, where a FOR ALL couple-write policy DOES exist), and
-- "finalize with no booked supplier" is unrepresentable rather than merely
-- refused by an action.
DROP POLICY IF EXISTS moodboard_part_finalizations_admin_all
  ON public.moodboard_part_finalizations;
CREATE POLICY moodboard_part_finalizations_admin_all
  ON public.moodboard_part_finalizations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supabase grants ALL on every new public table to anon + authenticated and
-- publishes it over REST. RLS is ROW-level and can never hide a COLUMN, so the
-- capability is taken away rather than merely policed. Both read policies say
-- `TO authenticated`, so anon can reach nothing here regardless — and the grant
-- and the policy audience have to move together
-- (tests/db/anon-table-grants-closed.db.test.ts).
REVOKE ALL ON TABLE public.moodboard_part_finalizations FROM anon;
-- The write capability is removed too: no policy grants it, and a future policy
-- added without thinking must not silently inherit a table-wide grant.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.moodboard_part_finalizations
  FROM authenticated;

-- ============================================================================
-- THE RPCs. Every one follows vendor_agree_to_lock's shape exactly:
--   ownership gate BEFORE any read
--   SELECT … FOR UPDATE                → serializes concurrent answerers
--   precondition returns, never raises → a non-transition answers
--   UPDATE … WHERE <same precondition> + GET DIAGNOSTICS ROW_COUNT
--   idempotent graceful re-call        → a double-click reports 'already'
-- ============================================================================

-- ---- 1 · the couple ASKS --------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_part_finalization(
  p_event_id  UUID,
  p_part_id   TEXT,
  p_vendor_id UUID,
  p_snapshot  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_ev_event UUID;
  v_id     UUID;
  v_live   TEXT;
BEGIN
  -- Ownership: the caller must be a couple/coordinator on this event, or admin.
  -- DEFINER + granted to authenticated, so this is the whole gate.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = p_event_id
       AND em.user_id  = auth.uid()
       AND em.member_type IN ('couple', 'coordinator')
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  -- 🛑 NO FINALIZE WITHOUT A BOOKED SUPPLIER — ENFORCED HERE, NOT ONLY IN THE UI.
  -- The four CONFIRMED statuses are lib/events.ts's CONFIRMED_VENDOR_STATUSES,
  -- the same four `lockRequestStateOf` calls a real booking. A shortlisted or
  -- merely-contacted shop has agreed to nothing and cannot be asked to agree to
  -- a design; and the booking must belong to THIS event, or a couple could aim
  -- a request at somebody else's supplier.
  SELECT ev.status::TEXT, ev.event_id INTO v_status, v_ev_event
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_ev_event <> p_event_id THEN
    RAISE EXCEPTION 'booking_not_on_this_event' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('status', 'not_booked', 'current', v_status);
  END IF;

  -- A part with a live handshake is not askable again — the partial unique
  -- index enforces it, but returning the reason beats a 23505 the UI has to
  -- guess at.
  SELECT state INTO v_live
    FROM public.moodboard_part_finalizations
   WHERE event_id = p_event_id AND part_id = p_part_id
     AND state IN ('pending', 'agreed')
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already', 'current', v_live);
  END IF;

  INSERT INTO public.moodboard_part_finalizations
    (event_id, part_id, vendor_id, state, design_snapshot,
     requested_at, requested_by_user_id)
  VALUES
    (p_event_id, p_part_id, p_vendor_id, 'pending', COALESCE(p_snapshot, '{}'::jsonb),
     NOW(), auth.uid())
  RETURNING finalization_id INTO v_id;

  RETURN jsonb_build_object('status', 'ok', 'finalization_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_part_finalization(UUID, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_part_finalization(UUID, TEXT, UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_part_finalization(UUID, TEXT, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.request_part_finalization(UUID, TEXT, UUID, JSONB) IS
  'MB12 step 1: the couple asks a BOOKED supplier to agree to one part of the '
  'design. Refuses unless event_vendors.status is one of the four CONFIRMED '
  'values and the booking belongs to this event — so "finalize with no booked '
  'supplier" is impossible at the database, not merely hidden in the UI. Records '
  'the colours being asked about in design_snapshot. Freezes NOTHING: an ask is '
  'not an agreement.';

-- ---- 2 · the SUPPLIER agrees — and the freeze rides with it ---------------

CREATE OR REPLACE FUNCTION public.vendor_agree_to_part(
  p_finalization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row        public.moodboard_part_finalizations%ROWTYPE;
  v_palette    JSONB;
  v_snap_pal   JSONB;
  v_snap_rd    JSONB;
  v_touched    JSONB;
  v_touched_set TEXT[];
  v_added_keys TEXT[] := '{}';
  v_added_rd   TEXT[] := '{}';
  v_rd         JSONB;
  v_key        TEXT;
  v_rows       INTEGER;
BEGIN
  SELECT * INTO v_row
    FROM public.moodboard_part_finalizations
   WHERE finalization_id = p_finalization_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership — the caller must be the ASKED supplier (owner/admin/agent on
  -- this booking) or a platform admin. current_vendor_event_vendor_ids()
  -- resolves the exact event_vendors.vendor_id set the vendor org owns; it
  -- selects a NOT NULL primary key, so this NOT IN cannot yield NULL and cannot
  -- fail open.
  IF v_row.vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  IF v_row.state = 'agreed' THEN
    RETURN jsonb_build_object('status', 'already', 'agreed_at', v_row.agreed_at);
  END IF;
  IF v_row.state <> 'pending' THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_row.state);
  END IF;

  -- LAZY EXPIRY, no sweeper — the shipped idiom. Flipping rather than merely
  -- refusing matters: it releases moodboard_part_finalizations_one_live_uniq so
  -- the couple can ask again.
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= NOW() THEN
    UPDATE public.moodboard_part_finalizations
       SET state = 'expired'
     WHERE finalization_id = p_finalization_id
       AND state = 'pending';
    RETURN jsonb_build_object('status', 'expired', 'expired_at', v_row.expires_at);
  END IF;

  -- ══ WHAT THIS AGREEMENT WILL FREEZE ═════════════════════════════════════
  -- Computed BEFORE anything is written, because it is a difference: the keys
  -- the snapshot names MINUS the ones the couple had already made explicit by
  -- hand. Only what we add is ours to release when the part is re-opened.
  SELECT COALESCE(role_palette, '{}'::jsonb) INTO v_palette
    FROM public.events WHERE event_id = v_row.event_id FOR UPDATE;

  v_snap_pal := COALESCE(v_row.design_snapshot -> 'palette', '{}'::jsonb);
  v_snap_rd  := COALESCE(v_row.design_snapshot -> 'room_dressing', '{}'::jsonb);

  v_touched := COALESCE(v_palette -> 'touched_roles', '[]'::jsonb);
  IF jsonb_typeof(v_touched) <> 'array' THEN v_touched := '[]'::jsonb; END IF;
  SELECT COALESCE(array_agg(e #>> '{}'), '{}') INTO v_touched_set
    FROM jsonb_array_elements(v_touched) AS e;

  FOR v_key IN SELECT jsonb_object_keys(v_snap_pal) LOOP
    IF NOT (v_key = ANY (v_touched_set)) THEN v_added_keys := v_added_keys || v_key; END IF;
  END LOOP;

  v_rd := COALESCE(v_palette -> 'room_dressing', '{}'::jsonb);
  IF jsonb_typeof(v_rd) <> 'object' THEN v_rd := '{}'::jsonb; END IF;
  FOR v_key IN SELECT jsonb_object_keys(v_snap_rd) LOOP
    IF NOT (v_rd ? v_key) THEN v_added_rd := v_added_rd || v_key; END IF;
  END LOOP;

  -- ══ THE STATE FLIP ══════════════════════════════════════════════════════
  -- Precondition repeated in the WHERE (defence in depth alongside FOR UPDATE):
  -- single-winner even if the row lock above is ever removed.
  --
  -- ⚠ THE ROW MOVES FIRST, THE PALETTE SECOND, AND THE ORDER IS LOAD-BEARING.
  -- `reassert_part_finalization_freeze` reads AGREED rows; the palette write
  -- below is what applies the freeze, and it can only see this agreement if the
  -- row already says `agreed`. Both statements are in one function body, i.e.
  -- one transaction, so the pair still lands together or not at all — the order
  -- decides what the backstop sees, not whether it is atomic.
  UPDATE public.moodboard_part_finalizations
     SET state                  = 'agreed',
         agreed_at              = NOW(),
         answered_by_user_id    = auth.uid(),
         declined_at            = NULL,
         decline_reason         = NULL,
         frozen_palette_keys    = v_added_keys,
         frozen_dressing_fields = v_added_rd
   WHERE finalization_id = p_finalization_id
     AND state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent answerer between the FOR UPDATE and the
    -- UPDATE. Raise rather than return: nothing must half-land.
    RAISE EXCEPTION 'finalization_state_changed_under_us' USING ERRCODE = '40001';
  END IF;

  -- ══ THE FREEZE ══════════════════════════════════════════════════════════
  -- Same function body = same transaction. See the header: a row that says
  -- `agreed` while nothing froze is a supplier building a design that can still
  -- change under them, and it renders identically to a correct one.
  --
  -- 🔑 ONE IMPLEMENTATION, NOT TWO. This does not re-derive the merge — it calls
  -- the very function the events trigger calls, so the freeze applied at agree
  -- time and the freeze re-asserted on every later write are the same code.
  -- A second copy here would be a second opinion about what "frozen" means.
  UPDATE public.events
     SET role_palette          = public.reassert_part_finalization_freeze(
                                   event_id, COALESCE(role_palette, '{}'::jsonb)),
         mood_board_updated_at = NOW()
   WHERE event_id = v_row.event_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'agreed_at', NOW(),
    'frozen_palette_keys', to_jsonb(v_added_keys),
    'frozen_dressing_fields', to_jsonb(v_added_rd));
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_agree_to_part(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_agree_to_part(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_agree_to_part(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_agree_to_part(UUID) IS
  'MB12 step 2: the SUPPLIER agrees to one part of the couple''s design. Flips '
  'the row to agreed AND freezes the snapshot into events.role_palette '
  '(touched_roles + room_dressing) in the SAME transaction — the two are one '
  'act, so a part can never be finalized without freezing or frozen without '
  'being finalized. Single-winner via FOR UPDATE + a state=''pending'' '
  'precondition repeated in the UPDATE. Lapsed rows expire lazily here rather '
  'than by a sweeper. Moves no money and no booking status.';

-- ---- 3 · the SUPPLIER declines -------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_decline_part(
  p_finalization_id UUID,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  public.moodboard_part_finalizations%ROWTYPE;
  v_rows INTEGER;
BEGIN
  SELECT * INTO v_row
    FROM public.moodboard_part_finalizations
   WHERE finalization_id = p_finalization_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  IF v_row.state = 'declined' THEN
    RETURN jsonb_build_object('status', 'already', 'declined_at', v_row.declined_at);
  END IF;
  IF v_row.state <> 'pending' THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_row.state);
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= NOW() THEN
    UPDATE public.moodboard_part_finalizations
       SET state = 'expired'
     WHERE finalization_id = p_finalization_id AND state = 'pending';
    RETURN jsonb_build_object('status', 'expired', 'expired_at', v_row.expires_at);
  END IF;

  UPDATE public.moodboard_part_finalizations
     SET state               = 'declined',
         declined_at         = NOW(),
         decline_reason      = NULLIF(btrim(COALESCE(p_reason, '')), ''),
         answered_by_user_id = auth.uid()
   WHERE finalization_id = p_finalization_id
     AND state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT * INTO v_row FROM public.moodboard_part_finalizations
     WHERE finalization_id = p_finalization_id;
    RETURN jsonb_build_object('status', 'already', 'current', v_row.state);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'declined_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_decline_part(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_decline_part(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_decline_part(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_decline_part(UUID, TEXT) IS
  'MB12: the SUPPLIER turns down one part of the design, in their own words '
  '(<= 240 chars, persisted — a design a supplier could not build must still be '
  'able to say why six months later). Freezes nothing. Releases the '
  'one-live-handshake slot, so the couple can redesign and ask again, or ask '
  'somebody else.';

-- ---- 4 · the couple WITHDRAWS a pending ask -------------------------------

CREATE OR REPLACE FUNCTION public.cancel_part_finalization_request(
  p_finalization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  public.moodboard_part_finalizations%ROWTYPE;
  v_rows INTEGER;
BEGIN
  SELECT * INTO v_row
    FROM public.moodboard_part_finalizations
   WHERE finalization_id = p_finalization_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = v_row.event_id
       AND em.user_id  = auth.uid()
       AND em.member_type IN ('couple', 'coordinator')
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  -- 🛑 A COUPLE MAY WITHDRAW A QUESTION. A COUPLE MAY NOT WITHDRAW AN ANSWER.
  -- If `agreed` could be cancelled here, the counter-handshake would be
  -- decorative: the couple could un-finalize alone and the supplier would be
  -- building against a design that moved without them. Re-opening a finalized
  -- part goes through request_part_reopen and needs the supplier's yes.
  IF v_row.state = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'already', 'cancelled_at', v_row.cancelled_at);
  END IF;
  IF v_row.state <> 'pending' THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_row.state);
  END IF;

  UPDATE public.moodboard_part_finalizations
     SET state = 'cancelled', cancelled_at = NOW()
   WHERE finalization_id = p_finalization_id
     AND state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT * INTO v_row FROM public.moodboard_part_finalizations
     WHERE finalization_id = p_finalization_id;
    RETURN jsonb_build_object('status', 'already', 'current', v_row.state);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'cancelled_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_part_finalization_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_part_finalization_request(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_part_finalization_request(UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_part_finalization_request(UUID) IS
  'MB12: the couple withdraws a still-PENDING ask. Refuses on an agreed row — '
  'un-finalizing needs the supplier''s agreement (request_part_reopen + '
  'vendor_answer_part_reopen), or the counter-handshake would be decorative.';

-- ---- 5 · the couple ASKS TO RE-OPEN --------------------------------------

CREATE OR REPLACE FUNCTION public.request_part_reopen(
  p_finalization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  public.moodboard_part_finalizations%ROWTYPE;
  v_rows INTEGER;
BEGIN
  SELECT * INTO v_row
    FROM public.moodboard_part_finalizations
   WHERE finalization_id = p_finalization_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = v_row.event_id
       AND em.user_id  = auth.uid()
       AND em.member_type IN ('couple', 'coordinator')
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  IF v_row.state <> 'agreed' THEN
    RETURN jsonb_build_object('status', 'not_finalized', 'current', v_row.state);
  END IF;
  IF v_row.reopen_state = 'pending' THEN
    RETURN jsonb_build_object('status', 'already', 'expires_at', v_row.reopen_expires_at);
  END IF;

  -- A fresh round clears the previous round's receipts, so a re-ask after a
  -- decline does not render carrying the last answer. The trigger stamps a
  -- FRESH reopen_expires_at on the transition into pending.
  UPDATE public.moodboard_part_finalizations
     SET reopen_state                = 'pending',
         reopen_requested_at         = NOW(),
         reopen_requested_by_user_id = auth.uid(),
         reopen_answered_at          = NULL,
         reopen_answered_by_user_id  = NULL,
         reopen_decline_reason       = NULL
   WHERE finalization_id = p_finalization_id
     AND state = 'agreed'
     AND (reopen_state IS NULL OR reopen_state <> 'pending');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.request_part_reopen(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_part_reopen(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_part_reopen(UUID) TO authenticated;

COMMENT ON FUNCTION public.request_part_reopen(UUID) IS
  'MB12: the couple asks the supplier to release a finalized part so it can '
  'change again. Opens the COUNTER-handshake on the same row, with its own '
  'fresh 48-hour fuse. Releases nothing by itself — the part stays frozen until '
  'the supplier answers.';

-- ---- 6 · the SUPPLIER answers the re-open — and the release rides with it --

CREATE OR REPLACE FUNCTION public.vendor_answer_part_reopen(
  p_finalization_id UUID,
  p_agree           BOOLEAN,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row        public.moodboard_part_finalizations%ROWTYPE;
  v_palette    JSONB;
  v_touched    JSONB;
  v_touched_set TEXT[];
  v_rd         JSONB;
  v_key        TEXT;
  v_rows       INTEGER;
BEGIN
  SELECT * INTO v_row
    FROM public.moodboard_part_finalizations
   WHERE finalization_id = p_finalization_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  IF v_row.reopen_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested');
  END IF;
  IF v_row.reopen_state <> 'pending' THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_row.reopen_state);
  END IF;

  -- LAZY EXPIRY on the counter-handshake too.
  -- ⚠ AN EXPIRED RE-OPEN LEAVES THE PART FINALIZED. Silence is not consent in
  -- either direction: nobody answering the couple's question does not release a
  -- design somebody already agreed to build. The couple may ask again — the
  -- expired round frees reopen_state for a fresh 'pending'.
  IF v_row.reopen_expires_at IS NOT NULL AND v_row.reopen_expires_at <= NOW() THEN
    UPDATE public.moodboard_part_finalizations
       SET reopen_state = 'expired'
     WHERE finalization_id = p_finalization_id
       AND reopen_state = 'pending';
    RETURN jsonb_build_object('status', 'expired', 'expired_at', v_row.reopen_expires_at);
  END IF;

  IF NOT p_agree THEN
    UPDATE public.moodboard_part_finalizations
       SET reopen_state               = 'declined',
           reopen_answered_at         = NOW(),
           reopen_answered_by_user_id = auth.uid(),
           reopen_decline_reason      = NULLIF(btrim(COALESCE(p_reason, '')), '')
     WHERE finalization_id = p_finalization_id
       AND reopen_state = 'pending';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('status', 'already');
    END IF;
    RETURN jsonb_build_object('status', 'ok', 'reopened', FALSE);
  END IF;

  -- ══ THE RELEASE ═════════════════════════════════════════════════════════
  -- Welded to the state change exactly as the freeze is welded to the
  -- agreement, and in the SAME ORDER and for the same reason: the row moves
  -- first so that the palette write below no longer sees an agreed row to
  -- re-freeze from. One function body, one transaction.
  --
  -- Releasing ONLY frozen_palette_keys / frozen_dressing_fields — the keys THIS
  -- agreement added — so a role the couple had touched by hand before
  -- finalizing stays theirs.
  --
  -- ⚠ THE STORED COLOURS ARE LEFT IN PLACE, exactly as `applyRelease` does
  -- (lib/mood-board-board-ops.ts): removing a key from touched_roles is what
  -- makes it follow the majors again; deleting its colours would blank the
  -- swatches for the instant before the next derive, and would lose the record
  -- of what was agreed.
  UPDATE public.moodboard_part_finalizations
     SET reopen_state               = 'agreed',
         reopen_answered_at         = NOW(),
         reopen_answered_by_user_id = auth.uid(),
         -- The finalization itself is over. 'cancelled' is the vocabulary's
         -- "this handshake was withdrawn" — here by mutual consent — and it
         -- frees the one-live-handshake slot so the part can be finalized again
         -- once it has been redesigned.
         state                      = 'cancelled',
         cancelled_at               = NOW(),
         frozen_palette_keys        = '{}',
         frozen_dressing_fields     = '{}'
   WHERE finalization_id = p_finalization_id
     AND reopen_state = 'pending'
     AND state = 'agreed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'reopen_state_changed_under_us' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(role_palette, '{}'::jsonb) INTO v_palette
    FROM public.events WHERE event_id = v_row.event_id FOR UPDATE;

  v_touched := COALESCE(v_palette -> 'touched_roles', '[]'::jsonb);
  IF jsonb_typeof(v_touched) <> 'array' THEN v_touched := '[]'::jsonb; END IF;
  SELECT COALESCE(array_agg(e #>> '{}'), '{}')
    INTO v_touched_set
    FROM jsonb_array_elements(v_touched) AS e
   WHERE NOT ((e #>> '{}') = ANY (v_row.frozen_palette_keys));
  v_palette := jsonb_set(v_palette, '{touched_roles}', to_jsonb(v_touched_set), TRUE);

  v_rd := COALESCE(v_palette -> 'room_dressing', '{}'::jsonb);
  IF jsonb_typeof(v_rd) <> 'object' THEN v_rd := '{}'::jsonb; END IF;
  FOREACH v_key IN ARRAY v_row.frozen_dressing_fields LOOP
    v_rd := v_rd - v_key;
  END LOOP;
  v_palette := jsonb_set(v_palette, '{room_dressing}', v_rd, TRUE);

  UPDATE public.events
     SET role_palette          = v_palette,
         mood_board_updated_at = NOW()
   WHERE event_id = v_row.event_id;

  RETURN jsonb_build_object('status', 'ok', 'reopened', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_answer_part_reopen(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_answer_part_reopen(UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_answer_part_reopen(UUID, BOOLEAN, TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_answer_part_reopen(UUID, BOOLEAN, TEXT) IS
  'MB12: the SUPPLIER answers the couple''s re-open request. On yes it releases '
  'ONLY what this agreement froze (frozen_palette_keys / frozen_dressing_fields) '
  'from events.role_palette AND closes the finalization, in one transaction — '
  'the mirror of vendor_agree_to_part. On no the part stays frozen, in the '
  'supplier''s own words. An unanswered re-open EXPIRES and the part stays '
  'frozen: silence is not consent in either direction.';

-- ---- 7 · the couple WITHDRAWS a pending re-open ---------------------------

CREATE OR REPLACE FUNCTION public.cancel_part_reopen_request(
  p_finalization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  public.moodboard_part_finalizations%ROWTYPE;
  v_rows INTEGER;
BEGIN
  SELECT * INTO v_row
    FROM public.moodboard_part_finalizations
   WHERE finalization_id = p_finalization_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = v_row.event_id
       AND em.user_id  = auth.uid()
       AND em.member_type IN ('couple', 'coordinator')
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  IF v_row.reopen_state IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('status', 'not_pending', 'current', v_row.reopen_state);
  END IF;

  UPDATE public.moodboard_part_finalizations
     SET reopen_state       = 'cancelled',
         reopen_answered_at = NOW()
   WHERE finalization_id = p_finalization_id
     AND reopen_state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_part_reopen_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_part_reopen_request(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_part_reopen_request(UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_part_reopen_request(UUID) IS
  'MB12: the couple changes their mind about re-opening. Closes the '
  'counter-handshake and leaves the part finalized — the supplier keeps the '
  'agreement they gave.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   -- an unbooked supplier is refused, and nothing is written:
--   SELECT public.request_part_finalization(
--     '<event>', 'people:bride', '<considering booking>', '{}'::jsonb);
--                                          -- {"status":"not_booked", …}
--   -- the fuse is materialized, and it is 48 hours:
--   SELECT expires_at - requested_at FROM public.moodboard_part_finalizations
--    ORDER BY created_at DESC LIMIT 1;      -- 48:00:00
--   -- agreeing freezes, in the same breath:
--   SELECT public.vendor_agree_to_part('<finalization>');
--   SELECT role_palette -> 'touched_roles' FROM public.events
--    WHERE event_id = '<event>';            -- includes the snapshot's keys
--   -- and the couple alone cannot undo it:
--   SELECT public.cancel_part_finalization_request('<finalization>');
--                                          -- {"status":"not_pending","current":"agreed"}
-- ============================================================================
