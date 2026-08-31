-- ═══════════════════════════════════════════════════════════════════════════
-- A GUEST CAN GIVE HER UNUSED CREDITS BACK TO THE CELEBRATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-08-31, asked for this feature in as many words after being shown
-- what it is: a guest who chose *"keep them for me"* at the till can change her
-- mind later and hand the part she has NOT shot to the couple's shared pot.
--
-- Spec § 7b's reversal half. The purchase-time choice already ships; this is
-- the "later" half, and it has never existed.
--
-- ── THIS IS THE SECOND ATTEMPT. THE FIRST ONE SHIPPED BROKEN ──────────────
-- 🔑 PR #5028 built this button on `papic_dedicate_shots` because the corpus
-- said that function was *"that call in the pot direction. Nothing new."* It
-- went live and moved credits THE WRONG WAY ON BOTH SIDES: measured at
-- pot 3,000 · bought 137 · shot 41, her balance went 137 → 178 and the shared
-- pot 3,050 → 3,009, while the button offered 96. Removed by PR #5038, whose
-- `papic-a-grant-cannot-be-released.db.test.ts` holds the autopsy — and whose
-- `releasesContract` is the contract THIS migration is built to satisfy.
--
-- The reason, which is the whole design constraint here:
--
--   dedicated to a camera = its GRANTS  +  its ALLOCATION
--                           ↑ what was     ↑ what the host
--                             BOUGHT         HANDED it
--
-- `papic_dedicate_shots` owns the RIGHT column only. A guest's purchase is a
-- `one_reload` rung granted via `papic_grant_camera_points`, so it lands in the
-- LEFT one, where that function cannot reach it. Widening it was considered and
-- rejected: the pot arithmetic is built on those two columns meaning different
-- things, and one function writing both is how they stop meaning different
-- things.
--
-- ── SO WHY NOT JUST LOWER THE GRANT ROW? ──────────────────────────────────
-- ⛔ Because `papic_event_point_grants` is an APPEND-ONLY MONEY RECORD. An
-- admin reconciles a customer's order against it; its own CHECK is points > 0;
-- and 20271131476413's header says in as many words that a grant row records
-- WHAT WAS BOUGHT and that handing shots around "must not look like a purchase
-- in that ledger". Editing it to represent a later gift would make a paid order
-- read as though it had been for a smaller amount — the receipt would change
-- after the fact.
--
-- ⚠ It would also break a live ceiling rule. `papic_guest_self_funded_spend`
-- (20271185324597) reads those same grant rows to decide how much of her spend
-- was HER money and therefore exempt from the couple's per-guest ceiling.
-- Shrinking the grant would retroactively shrink the exemption for shots she
-- had ALREADY legitimately taken with her own money.
--
-- ── THE SHAPE: A THIRD LAYER, THE SAME WAY THE SECOND ONE WAS ADDED ───────
-- One more mutable layer composed by the same two read functions, exactly as
-- `papic_seat_allocations` was in 20271131476413. Nothing downstream changes,
-- because every gate, meter and refund path already asks those two functions
-- rather than the tables:
--
--   dedicated to a camera = seat grants + allocation − RELEASED
--   left in the shared pot = shared grants − every allocation + EVERY RELEASE
--
-- Zero-sum by construction: what a camera gives up, the pot gains, in one
-- statement under one lock.

-- ── 1 · the ledger ─────────────────────────────────────────────────────────
--
-- ONE row per camera holding the CUMULATIVE amount that camera has given back.
-- Current state, not a log of moves — the same choice `papic_seat_allocations`
-- made, and for the same reason: composing two layers is arithmetic, replaying
-- a log is a migration waiting to go wrong.
CREATE TABLE IF NOT EXISTS public.papic_seat_grant_releases (
  seat_id    UUID PRIMARY KEY REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  points     INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS papic_seat_grant_releases_event_idx
  ON public.papic_seat_grant_releases(event_id);

COMMENT ON TABLE public.papic_seat_grant_releases IS
  'How many credits a guest has GIVEN BACK from her own camera to the event''s '
  'shared pot (spec 7b, owner 2026-08-31). ONE row per camera holding the '
  'CUMULATIVE amount — not a log of moves. Composed with '
  'papic_event_point_grants and papic_seat_allocations by '
  'papic_seat_dedicated_points and papic_event_pool_status; never read directly '
  'by a capture path. Exists so that giving credits back never edits '
  'papic_event_point_grants, which is an append-only money record an admin '
  'reconciles orders against.';

-- Every table in `public` ships OPEN — the default ACL grants arwdDxtm to anon
-- and authenticated. RLS at CREATE TABLE time AND an explicit REVOKE, both.
-- No policy on purpose: written only by the SECURITY DEFINER function below,
-- read only through the two composing functions. Same posture as
-- papic_seat_allocations and papic_event_point_grants.
ALTER TABLE public.papic_seat_grant_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.papic_seat_grant_releases FROM PUBLIC, anon, authenticated;

-- ── 2 · a camera's dedicated balance now nets off what it gave back ────────
--
-- Replaces the definition from 20271131476413 (the last one — nothing between
-- then and now redefines it). The grants and allocation halves are
-- byte-identical; the release is subtracted on top.
--
-- Everything downstream composes for free, which is the entire reason this went
-- here rather than into a capture path:
--   • papic_camera_points_remaining subtracts this camera's spend from it
--   • papic_reserve_camera_points spends it before the shared pool
--   • papic_reserve_event_points_for_seat returns -1 while it is > 0
-- A guest who gives everything back therefore falls through to the shared pool
-- on her next shot, like any ordinary guest — which is precisely what "I am
-- going back to being an ordinary guest" is supposed to mean.
CREATE OR REPLACE FUNCTION public.papic_seat_dedicated_points(
  p_seat_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, (
    COALESCE((SELECT SUM(points) FROM public.papic_event_point_grants
               WHERE seat_id = p_seat_id), 0)
  + COALESCE((SELECT points FROM public.papic_seat_allocations
               WHERE seat_id = p_seat_id), 0)
  - COALESCE((SELECT points FROM public.papic_seat_grant_releases
               WHERE seat_id = p_seat_id), 0)
  ))::INTEGER;
$$;

COMMENT ON FUNCTION public.papic_seat_dedicated_points(UUID) IS
  'Total shots DEDICATED to one camera: what was granted straight to it, plus '
  'what the host has handed it out of the shared pot, MINUS what its guest has '
  'given back to the celebration. 0 means "not a dedicated camera" — the caller '
  'then falls through to the shared pool.';

REVOKE ALL ON FUNCTION public.papic_seat_dedicated_points(UUID)
  FROM PUBLIC, anon, authenticated;

-- ── 3 · the shared pot gains what the cameras gave back ────────────────────
--
-- Replaces 20271184624871's definition. ONE arithmetic change: v_released is
-- added to the total.
--
-- ⚠ REPLACING THIS FUNCTION MEANS INHERITING ITS CURRENT BODY, NOT AN OLDER
-- ONE. An earlier draft of this migration copied the body from 20271131476413
-- and silently reverted 20271184624871's extraction of the guest headcount into
-- `papic_event_guest_headcount()` — a fix that exists so this function and the
-- per-guest share cannot drift. CI caught it (`papic-guest-spend-ceiling`'s
-- "the headcount is asked once"). Diff against the LATEST definer before you
-- replace a function; there are six of them for this one.
--
-- ⚠ ADDED TO total_points, NEVER TO granted_points — the mirror image of the
-- warning 20271131476413 left here about v_alloc, and load-bearing for the same
-- reason. `granted_points <= 0` is this function's test for "this event has no
-- Papic pool product at all". Fold releases into granted and an event with no
-- pool product would spring into existence the moment one guest gave credits
-- back. granted_points keeps meaning "what was bought"; total_points means
-- "what is still shared".
CREATE OR REPLACE FUNCTION public.papic_event_pool_status(
  p_event_id UUID
) RETURNS TABLE (
  applies          BOOLEAN,
  guest_count      INTEGER,
  base_points      INTEGER,
  granted_points   INTEGER,
  total_points     INTEGER,
  used_points      INTEGER,
  remaining_points INTEGER,
  soft_stop_at     INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_guest INTEGER;
  v_floor     INTEGER;
  v_ceiling   INTEGER;
  v_soft_pct  INTEGER;
  v_guests    INTEGER;
  v_base      INTEGER;
  v_granted   INTEGER;
  v_alloc     INTEGER;
  v_released  INTEGER;
  v_total     INTEGER;
  v_used      INTEGER;
  v_has_flat  BOOLEAN;
BEGIN
  v_has_flat := public.papic_event_has_flat_pass(p_event_id);

  -- SHARED grants only. seat_id NOT NULL is a camera's own balance.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id
     AND seat_id IS NULL;

  IF NOT v_has_flat AND COALESCE(v_granted, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- What the host has handed out to individual cameras. Those shots are still
  -- the event's; they are just no longer shared.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_alloc
    FROM public.papic_seat_allocations
   WHERE event_id = p_event_id;

  -- What guests have given back out of their OWN bought credits. Those were
  -- never the event's before; they are now.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_released
    FROM public.papic_seat_grant_releases
   WHERE event_id = p_event_id;

  SELECT points_per_guest, floor_points, ceiling_points, soft_stop_pct
    INTO v_per_guest, v_floor, v_ceiling, v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  IF v_has_flat THEN
    v_guests := COALESCE(public.papic_event_guest_headcount(p_event_id), 0);
    v_base := LEAST(v_ceiling, GREATEST(v_floor, v_guests * v_per_guest));
  ELSE
    v_guests := 0;
    v_base := 0;
  END IF;

  v_total := v_base + COALESCE(v_granted, 0) - COALESCE(v_alloc, 0) + COALESCE(v_released, 0);

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_event_pool_usage
   WHERE event_id = p_event_id;
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    TRUE,
    v_guests,
    v_base,
    COALESCE(v_granted, 0),
    v_total,
    v_used,
    GREATEST(0, v_total - v_used),
    (v_total * v_soft_pct) / 100;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_event_pool_status(UUID)
  FROM PUBLIC, anon, authenticated;

-- ── 4 · what could still move ──────────────────────────────────────────────
--
-- ONE EXPRESSION, TWO READERS. The button has to show a number before she taps
-- it, and the write has to compute one at the moment it writes. #5028's defect
-- lived exactly in that gap: the page did its own arithmetic
-- (`dedicated - spent`) and the call did different arithmetic, and nothing
-- forced them to agree. So the number is defined once, here, and BOTH the
-- display and the mover below read it.
--
--   LEAST( her own un-released grants , dedicated - already shot )
--
-- Two ceilings, both necessary:
--   • FIRST — she may only give back HER OWN bought credits. Credits the HOST
--     handed her camera (`papic_seat_allocations`) are the couple's money; the
--     host takes those back with `papic_dedicate_shots`, and a guest handing
--     the couple's own money "back" to the couple would double-count it into
--     the pot.
--   • SECOND — what a camera has already SHOT can never come back. Spend is
--     charged against the combined dedicated balance and the ledger does not
--     split it by funding source, so the honest floor is the same one
--     `papic_dedicate_shots` uses: never let total dedicated fall below total
--     spend.
CREATE OR REPLACE FUNCTION public.papic_seat_releasable_grants(
  p_seat_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      COALESCE((SELECT SUM(points) FROM public.papic_event_point_grants
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS grants,
      COALESCE((SELECT points FROM public.papic_seat_allocations
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS alloc,
      COALESCE((SELECT points FROM public.papic_seat_grant_releases
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS released,
      COALESCE((SELECT points_used FROM public.papic_seat_point_usage
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS spent
  )
  SELECT LEAST(
           GREATEST(0, s.grants - s.released),
           GREATEST(0, (s.grants + s.alloc - s.released) - s.spent)
         )::INTEGER
    FROM s;
$$;

COMMENT ON FUNCTION public.papic_seat_releasable_grants(UUID) IS
  'How many credits this camera''s guest could still give back to the '
  'celebration: her own un-released bought credits, never more than would drop '
  'the camera below what it has already SHOT. THE one definition — the buy '
  'panel displays it and papic_release_seat_grants moves exactly it, so the '
  'number on the button and the number that moves cannot drift apart (they did '
  'in PR #5028, and that was the defect).';

REVOKE ALL ON FUNCTION public.papic_seat_releasable_grants(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_seat_releasable_grants(UUID) TO service_role;

-- ── 4b · the move ──────────────────────────────────────────────────────────
--
-- Gives back everything this camera can still give back, and returns how many
-- credits moved.
--
-- ── NO AMOUNT PARAMETER, ON PURPOSE ───────────────────────────────────────
-- 🔑 The caller cannot name a figure, so there is no figure for a stale page,
-- a double-tap or a hostile POST to get wrong. The amount is DERIVED here,
-- under the row lock, at the moment of the write. A second press finds nothing
-- left and returns 0 — idempotent by construction rather than by a guard
-- somebody has to remember. This is the lesson from `papic_dedicate_shots`
-- taking a TARGET: that shape is right for a host TYPING a number and wrong
-- for a guest pressing one button.
--
-- It CLAMPS rather than refusing, and that is a deliberate difference from
-- `papic_dedicate_shots`, which refuses. The host there TYPES a number, so a
-- silent clamp would hide that he misunderstood. Here there is no number to
-- misunderstand — "give back whatever is left" is exactly satisfied by giving
-- back whatever is left, and the return value says how much that was.
CREATE OR REPLACE FUNCTION public.papic_release_seat_grants(
  p_event_id UUID,
  p_seat_id  UUID,
  p_actor    UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat_event UUID;
  v_released   INTEGER;
  v_movable    INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_seat_id IS NULL THEN
    RAISE EXCEPTION 'papic_release_seat_grants: bad arguments'
      USING ERRCODE = '22023';
  END IF;

  -- CROSS-EVENT GUARD. A seat id is not a capability: without this, somebody
  -- standing at one event could name another event's camera and push credits
  -- into THIS event's pot. Same guard papic_dedicate_shots and the camera-grant
  -- path both carry, and the same reason.
  SELECT event_id INTO v_seat_event
    FROM public.paparazzi_seats
   WHERE seat_id = p_seat_id;
  IF v_seat_event IS NULL OR v_seat_event <> p_event_id THEN
    RAISE EXCEPTION 'papic_release_seat_grants: camera does not belong to this event'
      USING ERRCODE = '42501';
  END IF;

  -- Take the row lock BEFORE computing anything, so two taps cannot both read
  -- the same "still unused" figure and both give it away. The row has to exist
  -- to be locked, hence insert-then-lock.
  INSERT INTO public.papic_seat_grant_releases (seat_id, event_id, points)
  VALUES (p_seat_id, p_event_id, 0)
  ON CONFLICT (seat_id) DO NOTHING;

  SELECT points INTO v_released
    FROM public.papic_seat_grant_releases
   WHERE seat_id = p_seat_id
     FOR UPDATE;
  v_released := COALESCE(v_released, 0);

  -- The SAME function the button displayed, re-evaluated here under the lock.
  -- Never the number the page sent; there is no such number.
  v_movable := COALESCE(public.papic_seat_releasable_grants(p_seat_id), 0);

  IF v_movable <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.papic_seat_grant_releases
     SET points     = v_released + v_movable,
         updated_at = NOW(),
         updated_by = p_actor
   WHERE seat_id = p_seat_id;

  RETURN v_movable;
END;
$$;

COMMENT ON FUNCTION public.papic_release_seat_grants(UUID, UUID, UUID) IS
  'A guest gives her UNUSED bought credits back to the celebration (spec 7b, '
  'owner 2026-08-31). Takes NO amount — the figure is derived from '
  'papic_seat_releasable_grants under the row lock at the moment of the write, '
  'so a stale page, a double-tap and a hostile POST cannot name one. Returns '
  'how many credits moved; a second call returns 0. Zero-sum: what the camera '
  'gives up, the shared pot gains. Never touches papic_event_point_grants (an '
  'append-only money record) and never gives back credits the HOST handed the '
  'camera — those are the couple''s money and come back via '
  'papic_dedicate_shots.';

REVOKE ALL ON FUNCTION public.papic_release_seat_grants(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_release_seat_grants(UUID, UUID, UUID)
  TO service_role;

-- ── 5 · assertions ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_relrowsecurity BOOLEAN;
  v_dedicated_body TEXT;
  v_pool_body      TEXT;
  v_mover_body     TEXT;
BEGIN
  -- ⚠ COMMENTS ARE STRIPPED BEFORE ANY MATCH BELOW, AND THAT IS NOT COSMETIC.
  -- `pg_get_functiondef` returns a body INCLUDING its comments, so a docblock
  -- that NAMES the thing a check looks for SATISFIES that check. Measured
  -- during this migration's own mutation testing: deleting the real
  -- `papic_event_guest_headcount(...)` call left its assertion GREEN, because a
  -- comment two lines above the call still said the words. The guard was inert
  -- and looked identical to a working one — the exact failure mode this feature
  -- has already shipped once. Same rule the TypeScript guards follow via
  -- lib/strip-comments.ts. Line comments only; no block comments live inside
  -- these bodies.
  SELECT regexp_replace(pg_get_functiondef(
           'public.papic_seat_dedicated_points(uuid)'::regprocedure), '--[^\n]*', '', 'g')
    INTO v_dedicated_body;
  SELECT regexp_replace(pg_get_functiondef(
           'public.papic_event_pool_status(uuid)'::regprocedure), '--[^\n]*', '', 'g')
    INTO v_pool_body;
  SELECT regexp_replace(pg_get_functiondef(
           'public.papic_release_seat_grants(uuid,uuid,uuid)'::regprocedure), '--[^\n]*', '', 'g')
    INTO v_mover_body;

  SELECT relrowsecurity INTO v_relrowsecurity
    FROM pg_class WHERE oid = 'public.papic_seat_grant_releases'::regclass;
  IF NOT COALESCE(v_relrowsecurity, FALSE) THEN
    RAISE EXCEPTION 'papic_seat_grant_releases shipped without RLS';
  END IF;

  IF has_table_privilege('anon', 'public.papic_seat_grant_releases', 'SELECT')
     OR has_table_privilege('authenticated', 'public.papic_seat_grant_releases', 'SELECT') THEN
    RAISE EXCEPTION
      'papic_seat_grant_releases is readable by a session role — new public tables ship OPEN, REVOKE was missed';
  END IF;

  -- Both composing reads must actually compose. A read that ignored the new
  -- table would leave every give-back invisible on one side of the ledger —
  -- which is the exact shape of the defect this migration exists to repair.
  IF (SELECT v_dedicated_body) NOT LIKE '%papic_seat_grant_releases%' THEN
    RAISE EXCEPTION 'papic_seat_dedicated_points does not subtract papic_seat_grant_releases';
  END IF;
  IF (SELECT v_pool_body) NOT LIKE '%papic_seat_grant_releases%' THEN
    RAISE EXCEPTION 'papic_event_pool_status does not add papic_seat_grant_releases';
  END IF;

  -- The layers this one is defined against must still be there. If a future
  -- migration drops the allocation layer, the arithmetic above is wrong in a
  -- way no test of THIS feature would notice.
  IF (SELECT v_dedicated_body) NOT LIKE '%papic_seat_allocations%' THEN
    RAISE EXCEPTION 'papic_seat_dedicated_points no longer reads papic_seat_allocations';
  END IF;
  IF (SELECT v_pool_body) NOT LIKE '%papic_seat_allocations%' THEN
    RAISE EXCEPTION 'papic_event_pool_status no longer subtracts papic_seat_allocations';
  END IF;

  -- THE TWO READERS MUST BE ONE EXPRESSION. If the mover ever stops calling
  -- papic_seat_releasable_grants it has started doing its own arithmetic, and
  -- the number on the button and the number that moves can drift — which is
  -- the exact defect (#5028) this whole migration exists to repair.
  IF (SELECT v_mover_body) NOT LIKE '%papic_seat_releasable_grants%' THEN
    RAISE EXCEPTION
      'papic_release_seat_grants no longer derives its amount from papic_seat_releasable_grants';
  END IF;

  -- And the mover must take no amount from its caller. A p_points argument
  -- would put the figure back in the browser's hands.
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = 'public.papic_release_seat_grants(uuid,uuid,uuid)'::regprocedure
       AND pronargs <> 3
  ) THEN
    RAISE EXCEPTION 'papic_release_seat_grants signature changed — it must take no amount';
  END IF;

  -- THE HEADCOUNT STAYS EXTRACTED. This migration REPLACES
  -- papic_event_pool_status, so it can silently undo anything an earlier
  -- migration did to that body — and an earlier draft of this one did exactly
  -- that. Asserted so the next replacement is told, not trusted.
  IF (SELECT v_pool_body) NOT LIKE '%papic_event_guest_headcount%' THEN
    RAISE EXCEPTION
      'papic_event_pool_status stopped calling papic_event_guest_headcount — a replacement reverted 20271184624871';
  END IF;

  -- anon must not be able to call the mover. It is reachable only through the
  -- server action, which resolves the camera from a credential.
  IF has_function_privilege('anon',
       'public.papic_release_seat_grants(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'papic_release_seat_grants is anon-callable';
  END IF;
END $$;
