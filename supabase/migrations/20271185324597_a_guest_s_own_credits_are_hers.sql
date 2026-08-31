-- ═══════════════════════════════════════════════════════════════════════════
-- A GUEST'S OWN CREDITS ARE HERS — the couple's ceiling stops eating them
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-08-28 (DECISION_LOG row "SHOTS PER GUEST — ALL THREE DECISIONS
-- MADE", § b, in his own words: *"both. they can claim it all or share it to
-- everybody."*): at the moment a guest buys, SHE picks —
--
--   • **keep them for me**            → her money, her shots, and *the couple's
--                                       limit does not touch them*
--   • **add them to the celebration** → into the shared pot for the room, and
--                                       she reverts to an ordinary equal share
--
-- This is session S5's gate half. **The CHOICE already ships** — the buy sheet
-- has offered both since 2026-07-29 (`app/papic/_components/papic-buy-shell.tsx`
-- renders "This camera only" over `one_reload` and "Everyone's pool" over
-- `pool_topup`, on both live capture surfaces). What was missing is the half
-- that makes the first of those two sentences true.
--
-- ── THE DEFECT, READ OFF THE APPLIED FUNCTION ──────────────────────────────
-- `papic_record_guest_capture` (20271184624871 § 7) meters a guest against the
-- couple's ceiling like this:
--
--     SELECT COALESCE(SUM(points_cost), 0)::INTEGER INTO v_used
--       FROM public.papic_guest_captures
--      WHERE guest_id = p_guest_id;
--     ...
--     IF v_ceiling IS NOT NULL AND (v_used + v_cost) > v_ceiling THEN  -- refuse
--
-- `v_used` sums EVERY capture that guest has ever made with **no distinction of
-- funding source**. So a guest the couple NAMED (a row in
-- `papic_guest_spend_ceilings`) who ALSO chose "keep them for me" has the shots
-- she paid for counted against the couple's number and is refused early. Her own
-- purchase is consumed by somebody else's limit — the exact opposite of what she
-- was sold.
--
-- ⚠ WHY NOTHING CAUGHT IT. Every test of that gate was written for a guest whose
-- captures all come from the shared pot. The case only exists where the ceiling
-- feature and the guest-buy feature MEET, and no session owned both.
--
-- ── 🔎 IT IS INERT TODAY, AND THAT IS THIN ─────────────────────────────────
-- Measured in production 2026-08-31: 5 events · **0** with
-- `papic_guest_spend_ceiling_on` TRUE · **0** rows in
-- `papic_guest_spend_ceilings`. No ceiling binds on anybody yet. But the BUYING
-- half is LIVE — `NEXT_PUBLIC_PAPIC_GUEST_BUY` is ON in the real Vercel
-- Production environment (`build-sessions/P0-b-SWITCHES.md`). This goes live the
-- moment one couple names one guest who has also bought. A limit that is wrong
-- and unreachable becomes a limit that is wrong the day somebody uses it.
--
-- ── ⛔ THE FUNDING SOURCE IS NEVER TAKEN FROM THE CALLER ───────────────────
-- 🚨 `papic_record_guest_capture` IS ANON-CALLABLE. 20271114597183 deliberately
-- keeps its EXECUTE for `anon` + `authenticated` — "that is the anonymous
-- guest-capture path and must keep working" — so it is the ONE object a hostile
-- direct caller still reaches. A `p_self_funded BOOLEAN` parameter would be a
-- one-word walk through the ceiling *entirely*: set it on every call and no
-- capture is ever metered. That is precisely the defect
-- `papic_reserve_camera_capture` was closed for (`p_limit IS NULL` ⇒
-- unconditional TRUE), and the ceiling migration states the asymmetry it lives
-- under in as many words: **"cost in, ceiling read from the couple's own
-- table."** The funding source is a LIMIT-shaped fact, not a cost-shaped one, so
-- it is derived here from stored state and nowhere else.
--
-- ── HOW IT IS DERIVED — the same stored state the split already uses ───────
-- The pot/dedicated split is ALREADY decided from stored state at spend time by
-- `papic_reserve_capture_split` (20271131963489): a camera's own credits first,
-- the pot for the remainder, under one row lock. Two ledgers it leaves behind
-- are all this needs, and neither is writable by a session role:
--
--   `papic_seat_point_usage.points_used`  — credits this camera has spent out of
--        its DEDICATED balance. Written ONLY by the split reserve and by
--        `papic_reserve_camera_points` on the dedicated branch (the per-day
--        branch writes `papic_seat_day_usage` instead), so it is exactly
--        "dedicated credits spent", never anything else.
--
--   `papic_event_point_grants` ⨝ `papic_guest_orders` — what SHE bought. A
--        "keep them for me" purchase is `purchase_kind = 'one_reload'`, which
--        `papic_guest_orders_reload_needs_seat_chk` forces to name a camera, and
--        `papic_grant_camera_points` lands it as a SEAT-scoped grant carrying
--        the order id. A "add them to the celebration" purchase is
--        `pool_topup`, which lands `seat_id IS NULL` — invisible here, which is
--        the whole point: those credits ARE the pot now.
--
--   exempt = LEAST( credits her camera has spent from its dedicated balance,
--                   credits HER OWN "keep them for me" purchases put on it )
--
-- The LEAST is what makes it safe. It can never exceed what she paid for, and it
-- can never exceed what was actually spent — so nothing is exempted on the
-- strength of a purchase she has not shot yet, and nothing is exempted on the
-- strength of a balance somebody else paid for.
--
-- ── ⚖ WHAT DELIBERATELY STILL COUNTS AGAINST THE CEILING, AND WHY ─────────
-- 🔑 **Credits the HOST handed to her camera** (`papic_seat_allocations`, via
-- `papic_dedicate_shots` — 20271131476413) still count. They are the couple's
-- own pot money moved onto one QR; the owner's ruling is about *"a guest who
-- BUYS credits"*, and this migration does not widen it. That is also the
-- SHIPPED behaviour — every dedicated credit counts today — so this change only
-- ever NARROWS what the ceiling eats, never widens it.
--
-- ⏭ **SURFACED FOR THE OWNER, NOT DECIDED HERE:** a couple who both names a
-- guest at 20 AND hands her camera 200 has given two contradictory
-- instructions, and the tighter one wins (the ceiling migration's own rule:
-- *"the tightest gate has to win"*). If he wants a hand-out to lift her ceiling
-- the way her own purchase does, that is one predicate in
-- `papic_guest_self_funded_spend` and a line in the decision log — but it is his
-- call, not this session's.
--
-- ── 🪤 THE ORDER OF OPERATIONS, AND WHY BOTH ORDERS ARE SAFE ──────────────
-- The route reserves the split and THEN records (app/api/papic/guest-capture/
-- route.ts). So by the time this gate runs, `points_used` already carries THIS
-- capture's dedicated leg while `papic_guest_captures` does not yet carry the
-- row — which is exactly why the arithmetic is `(v_used + v_cost) − exempt` and
-- not `v_used − exempt`, and why it comes out EXACT.
--
-- A hostile caller who skips the reserve and calls this function directly leaves
-- `points_used` stale, so the exempt figure is SMALLER and the gate is
-- STRICTER. Fail-safe in the only direction that matters: no ordering a caller
-- can arrange makes the ceiling looser.
--
-- ── 🪤 AND ONE BOUND ON THE EXEMPTION, STATED RATHER THAN ASSUMED ──────────
-- Her camera can in principle also shoot through the SEAT door
-- (`papic_record_seat_capture` → `papic_photos`), which spends the same
-- dedicated balance but lands in a different table and has no ceiling of its
-- own. Those credits would raise `points_used` without raising the sum over
-- `papic_guest_captures`, and she would then reach her ceiling PLUS the credits
-- she bought — having spent the bought ones elsewhere.
--
-- 📏 THE OVER-DRAW IS BOUNDED, AND THE BOUND IS A NUMBER RATHER THAN A HOPE:
-- her ceiling plus what she personally paid for, and NOT ONE CREDIT MORE. The
-- `LEAST` above is what bounds it — the exemption can never exceed her own
-- purchase, whatever a second door spent. Pinned by a test that shoots exactly
-- 70 against a ceiling of 20 and a purchase of 50 and asserts the 71st is
-- refused, so an unbounded exemption cannot be introduced later while every
-- other test stays green.
-- ⚖ In practice that door is shut for exactly this population:
-- `papic_record_seat_capture` refuses unless `claimer_user_id = p_claimer_user_id`
-- and a guest's own camera is minted with `claimer_user_id` NULL
-- (`ensureGuestOwnCameraAdmin`), because a roll camera is credentialed by the
-- guest's personal QR rather than by an auth uid (20270305788856).
-- ⏭ `claim_paparazzi_seat` WOULD claim a guest-linked camera for whoever
-- presents its `claim_qr_token` — it does not exclude `guest_id IS NOT NULL` —
-- but nothing renders that token for such a camera. FLAGGED, NOT FIXED HERE:
-- narrowing that claim path is its own change with its own blast radius.
-- Defended anyway, because "unreachable today" is not a guarantee.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · WHAT SHE PAID FOR, AND HAS SPENT — the one definition of "her money"
-- ═══════════════════════════════════════════════════════════════════════════
-- Returns CREDITS, never a boolean. "Is this capture self-funded?" is the wrong
-- question — a ten-second clip costs 8 and can be paid 2-from-her, 6-from-the-pot
-- (owner 2026-08-11: *"spend 2 and take 6"*). A per-capture flag could not
-- express that; a running total can, and it is the same shape the split reserve
-- already returns.
CREATE OR REPLACE FUNCTION public.papic_guest_self_funded_spend(
  p_guest_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat  UUID;
  v_paid  INTEGER;
  v_spent INTEGER;
BEGIN
  IF p_guest_id IS NULL THEN RETURN 0; END IF;

  -- Her camera. `paparazzi_seats_one_active_camera_per_guest` is a UNIQUE index
  -- over (event_id, guest_id) WHERE guest_id IS NOT NULL AND revoked_at IS NULL,
  -- and a guest row belongs to exactly one event, so this is at most one row.
  SELECT s.seat_id INTO v_seat
    FROM public.paparazzi_seats s
   WHERE s.guest_id = p_guest_id
     AND s.revoked_at IS NULL
   LIMIT 1;

  -- No camera of her own ⇒ she has never chosen "keep them for me", because
  -- that purchase cannot be made without one (`no_camera` in the buy action,
  -- and papic_guest_orders_reload_needs_seat_chk in the schema).
  IF v_seat IS NULL THEN RETURN 0; END IF;

  -- ── WHAT SHE BOUGHT ──────────────────────────────────────────────────────
  -- Grants sitting on HER camera whose order is one of HER OWN guest purchases
  -- of the "keep them for me" kind. The join through papic_guest_orders is what
  -- makes this HER money rather than merely money on her camera: a Papic One
  -- camera the COUPLE bought and pointed at her has a seat grant too, and that
  -- is not what the owner ruled about.
  --
  -- ⚠ NO ORDER-STATUS FILTER, ON PURPOSE. The grant row does not exist until
  -- `papic_grant_camera_points` runs on activation, so the grant's EXISTENCE is
  -- the proof of payment. Re-deriving "is it paid?" here would be a second copy
  -- of a money rule beside the first, and two copies always drift.
  SELECT COALESCE(SUM(g.points), 0)::INTEGER
    INTO v_paid
    FROM public.papic_event_point_grants g
    JOIN public.papic_guest_orders o ON o.order_id = g.order_id
   WHERE g.seat_id = v_seat
     AND o.guest_id = p_guest_id
     AND o.purchase_kind = 'one_reload';

  IF COALESCE(v_paid, 0) <= 0 THEN RETURN 0; END IF;

  -- ── WHAT HER CAMERA HAS ACTUALLY SPENT FROM ITS DEDICATED BALANCE ────────
  SELECT COALESCE(u.points_used, 0)::INTEGER
    INTO v_spent
    FROM public.papic_seat_point_usage u
   WHERE u.seat_id = v_seat;

  -- Never more than she bought; never more than was spent.
  RETURN LEAST(COALESCE(v_spent, 0), v_paid);
END;
$$;

COMMENT ON FUNCTION public.papic_guest_self_funded_spend(UUID) IS
  'Credits this guest has spent that HER OWN purchase paid for — the ONE place '
  '"keep them for me" is defined (owner 2026-08-28). Derived from stored state '
  'only: seat-scoped grants traceable to her own papic_guest_orders rows of kind '
  '''one_reload'', bounded by papic_seat_point_usage.points_used. Never taken '
  'from a caller — papic_record_guest_capture is anon-callable and a settable '
  '"this one is mine" would be a walk through the couple''s ceiling entirely. '
  'A "add them to the celebration" purchase (pool_topup) lands seat_id IS NULL '
  'and is deliberately invisible here: those credits ARE the pot now. Credits '
  'the HOST handed the camera (papic_seat_allocations) are the couple''s money '
  'and are deliberately NOT counted.';

REVOKE ALL ON FUNCTION public.papic_guest_self_funded_spend(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_guest_self_funded_spend(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · WHAT THE CEILING MEASURES — everything except the credits she paid for
-- ═══════════════════════════════════════════════════════════════════════════
-- ONE expression, TWO readers, and `p_extra_cost` is the entire reason it is one
-- function rather than two. The GATE asks "what would this be AFTER the capture
-- I am about to write?" and the guest's own counter asks "what is it NOW"; the
-- same question with the extra set to zero. Written twice, the display would
-- eventually disagree with the refusal — and a counter that disagrees with the
-- gate is how a guest is told she has credits left and then refused.
CREATE OR REPLACE FUNCTION public.papic_guest_ceiling_spend(
  p_guest_id   UUID,
  p_extra_cost INTEGER DEFAULT 0
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
  v_self INTEGER;
BEGIN
  IF p_guest_id IS NULL THEN RETURN 0; END IF;

  -- ⚠ CREDITS, NOT ROWS, and NO hidden_at FILTER — both inherited deliberately
  -- from the gate this replaces. Hiding a capture must never reset the meter
  -- (the vendor-side twin of that reset was a live hole, #4867).
  SELECT COALESCE(SUM(points_cost), 0)::INTEGER
    INTO v_used
    FROM public.papic_guest_captures
   WHERE guest_id = p_guest_id;

  v_self := public.papic_guest_self_funded_spend(p_guest_id);

  -- GREATEST(0, …) because the split reserve runs BEFORE the record, so `v_self`
  -- can legitimately be ahead of `v_used` by the dedicated leg of the capture
  -- currently in flight. A negative meter would read as credit.
  RETURN GREATEST(
    0,
    (COALESCE(v_used, 0) + GREATEST(COALESCE(p_extra_cost, 0), 0))
      - COALESCE(v_self, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.papic_guest_ceiling_spend(UUID, INTEGER) IS
  'What the couple''s per-guest ceiling has actually metered on this guest: '
  'every credit she has spent MINUS the ones her own "keep them for me" purchase '
  'paid for (owner 2026-08-28). p_extra_cost lets the capture gate ask the same '
  'question about the shot it is holding, so the gate and the guest''s own '
  'counter can never be two different numbers. Compare against '
  'papic_guest_spend_ceiling(), never against a total capture count.';

REVOKE ALL ON FUNCTION public.papic_guest_ceiling_spend(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_guest_ceiling_spend(UUID, INTEGER) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · THE GATE — the newest body REPLACED, not a fourth overload
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚨 THE SIGNATURE IS UNCHANGED, so this is a genuine CREATE OR REPLACE and NOT
-- a drop-and-create. That matters more than it looks: in PostgreSQL a new
-- parameter — even a defaulted one — is a NEW FUNCTION, and 20271184624871
-- measured what a second overload does to this exact object in a rolled-back
-- transaction against production. With two present and all arguments defaulted,
-- a named call fails `42725 function ... is not unique`; the route's fallback
-- ladder matches on /function .*papic_record_guest_capture/, WHICH MATCHES THAT
-- VERY ERROR, so it would have quietly retried the 2-argument shape and recorded
-- every clip as a photo with no duration and no poster. Silent data loss.
--
-- ⇒ There is exactly ONE overload now (two were dropped 2026-08-30) and there is
-- exactly one after this. The assertion at the foot of this file re-counts them
-- rather than trusting this paragraph.
--
-- ⇒ And because the signature does not move, no grant is dropped and no
-- deploy-window rung in the route changes. The guest camera is byte-identical
-- for every guest who has bought nothing — which is every guest in production
-- today.
CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id          UUID,
  p_r2_object_key     TEXT DEFAULT NULL,
  p_consent_to_public BOOLEAN DEFAULT false,
  p_media_type        TEXT DEFAULT 'photo',
  p_duration_ms       INT DEFAULT NULL,
  p_poster_r2_key     TEXT DEFAULT NULL,
  p_points_cost       INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits   CONSTANT INTEGER := 150;
  v_event_id  UUID;
  v_terms_at  TIMESTAMPTZ;
  v_blocked   BOOLEAN;
  v_owns      BOOLEAN;
  v_unlimited BOOLEAN;
  v_used      INTEGER;
  v_media     TEXT;
  v_duration  INT;
  v_pool_applies BOOLEAN;
  v_ceiling   INTEGER;
  v_cost      INTEGER;
  v_metered   INTEGER;
  v_self      INTEGER;
BEGIN
  -- Normalize media_type → only 'photo' | 'clip'; anything else falls back to
  -- 'photo' so a malformed caller never trips the CHECK constraint.
  v_media := CASE WHEN p_media_type = 'clip' THEN 'clip' ELSE 'photo' END;

  -- ⚠ THE COST IS TAKEN FROM THE CALLER AND THE CEILING IS NOT. That asymmetry
  -- is the whole design. lib/papic-cameras.ts owns both credit weights and is
  -- the single writer of them (1 photo · 8 for a ten-second clip); re-deriving
  -- them here would be a second copy of a money rule. But a caller who could
  -- also name the LIMIT could set it to infinity — which is the defect
  -- papic_reserve_camera_capture was closed for (`p_limit IS NULL` ⇒
  -- unconditional TRUE, 20271114597183). So: cost in, ceiling read from the
  -- couple's own table.
  -- 🔑 AND THE FUNDING SOURCE IS ON THE CEILING'S SIDE OF THAT LINE, not the
  -- cost's. "This one is mine" from a caller would exempt every capture from
  -- the ceiling on an anon-callable function — a wider hole than a wrong cost,
  -- because it removes the limit rather than mis-measuring it. It is derived
  -- below from ledgers no session role can write.
  -- The floor of 1 stops a crafted caller charging themselves nothing per
  -- capture; the CHECK on the column is the second half of the same guard.
  v_cost := GREATEST(COALESCE(p_points_cost, 1), 1);

  -- Clip duration is capped at the 10000ms clip lock (defense in depth —
  -- the client + route also enforce it). Photos carry no duration.
  v_duration := CASE
    WHEN v_media = 'clip' AND p_duration_ms IS NOT NULL
      THEN LEAST(GREATEST(p_duration_ms, 0), 10000)
    ELSE NULL
  END;

  -- Resolve the guest's event + terms-acceptance. A deleted guest cannot capture.
  SELECT event_id, ugc_terms_accepted_at INTO v_event_id, v_terms_at
  FROM public.guests
  WHERE guest_id = p_guest_id
    AND deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  -- Does the ONE shared event pool apply to this event (Free / One / Pool grant,
  -- or the legacy flat pass)? Resolved once and reused for both gates below.
  v_pool_applies := (SELECT applies FROM public.papic_event_pool_status(v_event_id));

  -- Ownership passes when the event owns PAPIC_GUEST OR the pool applies — the
  -- latter lets a Free event (owns nothing, holds only a free_grant) record via
  -- guest phones.
  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST')
            OR COALESCE(v_pool_applies, FALSE);
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  -- UGC moderation gate 1 — event-scoped block (Apple 1.2 / Play UGC). A blocked
  -- uploader cannot deposit anything into this event's gallery.
  SELECT EXISTS (
    SELECT 1 FROM public.event_blocked_users b
    WHERE b.event_id = v_event_id
      AND b.blocked_guest_id = p_guest_id
  ) INTO v_blocked;
  IF v_blocked THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  -- UGC moderation gate 2 — one-time terms acceptance before the first upload.
  IF v_terms_at IS NULL THEN
    RETURN jsonb_build_object('status', 'terms_required');
  END IF;

  -- "Unlock all of Papic": an ACTIVE (paid/fulfilled) PAPIC_UNLOCK order lifts the
  -- per-guest 150-credit cap. Mirrors apps/web/lib/entitlements.ts
  -- eventHasPapicUnlock (active-only) — a pending pass never lifts the cap.
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE event_id = v_event_id
      AND service_key = 'PAPIC_UNLOCK'
      AND status IN ('paid', 'fulfilled')
  ) INTO v_unlimited;

  -- ── THE COUPLE'S CEILING ON THIS ONE GUEST ───────────────────────────────
  -- NULL on every celebration that has not turned it on, which is all of them
  -- on the day this shipped.
  --
  -- ⚖ THE PRECEDENCE INSIDE THIS CALL IS UNTOUCHED BY THIS MIGRATION and must
  -- stay so: named guest → release → the couple's number → derived equal share,
  -- with a named guest's own figure asked FIRST and release-proof (owner 7c).
  -- This file changes only what is METERED against the number it returns.
  v_ceiling := public.papic_guest_spend_ceiling(p_guest_id);

  -- The event pool is the authoritative ceiling for a pool-driven event, so the
  -- per-guest 150 must NOT double-cap it: yield the per-guest gate whenever the
  -- pool applies.
  --
  -- 🔑 THE YIELD IS CONDITIONAL. The pot caps the celebration; the couple's
  -- ceiling caps ONE GUEST INSIDE IT, and the tightest gate has to win — a pot
  -- that stood the per-guest gate down unconditionally would make every ceiling
  -- inert on every event. With no ceiling set this line is what it was.
  v_unlimited := v_unlimited OR (COALESCE(v_pool_applies, FALSE) AND v_ceiling IS NULL);

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check. hashtextextended → bigint
  -- lock key scoped to this transaction. ONE gate inside ONE lock — a second
  -- gate in sequence after it could not be race-safe.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  -- ⚠ CREDITS, NOT ROWS — a ten-second clip costs 8 of them, and the constant
  -- beside this has always been called credits.
  -- ⚠ AND NO hidden_at FILTER. Hiding a capture must never reset the meter;
  -- the vendor-side twin of that reset was a live hole (#4867).
  --
  -- This is EVERYTHING she has spent, from whatever ledger. It is still the
  -- right number for the platform's own flat 150 below — that limit is about
  -- how much one phone may deposit into this gallery and has never cared who
  -- paid — and it is what the reply reports when no ceiling binds.
  SELECT COALESCE(SUM(points_cost), 0)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  -- ── 🚨 THE COUPLE'S CEILING BINDS FIRST, AND ON THE POT'S SHARE ONLY ─────
  -- Asked before the platform's own 150 and independently of `v_unlimited`: a
  -- PAPIC_UNLOCK pass says the COUPLE bought their way past OUR limit, which is
  -- not permission to walk through the limit the couple themselves set on one
  -- guest.
  --
  -- 🔑 AND WHAT IT MEASURES IS NO LONGER `v_used`. A guest who chose "keep them
  -- for me" spent her own money; the couple's limit does not touch those credits
  -- (owner 2026-08-28). `papic_guest_ceiling_spend` is that subtraction, and it
  -- is asked with `v_cost` so the answer is about the capture in hand — the same
  -- expression the guest's own counter reads with the extra at zero.
  IF v_ceiling IS NOT NULL THEN
    v_metered := public.papic_guest_ceiling_spend(p_guest_id, v_cost);
    IF v_metered > v_ceiling THEN
      RETURN jsonb_build_object(
        'status', 'quota_exhausted',
        -- The status stays what the route and the offline drain already handle
        -- (both release the booking and neither treats it as terminal). `reason`
        -- is what lets the guest's screen tell "your own allowance is spent"
        -- apart from "the celebration's credits are spent" — two refusals that
        -- must never inherit each other's copy.
        'reason', 'guest_spend_ceiling',
        'total', v_ceiling,
        -- ⚠ THE POT-METERED FIGURE, NOT THE TOTAL SHE HAS SHOT. Reporting the
        -- total here would tell a guest who bought 50 that she is 50 over a
        -- ceiling of 20 — the refusal would be correct and the explanation a
        -- lie, which is the shape this whole build exists to kill.
        'used', GREATEST(0, v_metered - v_cost),
        'remaining', GREATEST(0, v_ceiling - GREATEST(0, v_metered - v_cost)),
        'self_funded', public.papic_guest_self_funded_spend(p_guest_id)
        -- (asked once, on a path that ends here — no reuse to hoist it out of)
      );
    END IF;
  END IF;

  -- Unlock / pool events never exhaust here; otherwise the 150-credit pool binds.
  IF NOT v_unlimited AND (v_used + v_cost) > v_credits THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'reason', 'per_guest_credits',
      'total', v_credits,
      'used', v_used,
      'remaining', GREATEST(0, v_credits - v_used)
    );
  END IF;

  INSERT INTO public.papic_guest_captures (
    event_id, guest_id, r2_object_key, consent_to_public,
    media_type, duration_ms, poster_r2_key, points_cost
  )
  VALUES (
    v_event_id, p_guest_id, p_r2_object_key, COALESCE(p_consent_to_public, false),
    v_media, v_duration, NULLIF(btrim(COALESCE(p_poster_r2_key, '')), ''), v_cost
  );

  -- Re-asked AFTER the insert so the reply describes the world the guest is now
  -- in, with no `+ v_cost` arithmetic repeated at the call site.
  --
  -- ⚠ ONCE EACH, INTO A VARIABLE. Both figures below need the metered spend and
  -- both branches of the reply need the self-funded one; asking the functions
  -- again per field would put four extra aggregates on a path that runs at the
  -- product's stated peak of 250 captures a second.
  v_self := public.papic_guest_self_funded_spend(p_guest_id);
  IF v_ceiling IS NOT NULL THEN
    v_metered := public.papic_guest_ceiling_spend(p_guest_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', COALESCE(v_ceiling, v_credits),
    -- Under a ceiling, `used` is what the ceiling METERS — the credits that came
    -- from anywhere but her own purchase. Everywhere else it is what it always
    -- was, so a celebration with no ceiling reports byte-identically.
    'used', CASE
      WHEN v_ceiling IS NOT NULL THEN v_metered
      ELSE v_used + v_cost
    END,
    -- Unlimited guests report a non-zero remaining so no numeric consumer ever
    -- reads "exhausted"; the client shows "Unlimited" off the server-rendered
    -- flag regardless. A guest under a ceiling is never one of them.
    'remaining', CASE
      WHEN v_ceiling IS NOT NULL THEN GREATEST(0, v_ceiling - v_metered)
      WHEN v_unlimited THEN v_credits
      ELSE GREATEST(0, v_credits - (v_used + v_cost))
    END,
    'unlimited', (v_unlimited AND v_ceiling IS NULL),
    'ceiling', v_ceiling,
    -- What she has spent of her OWN, so a screen can say "and 30 of yours" and
    -- never has to derive it from two other numbers. 0 for every guest who has
    -- bought nothing, which is every guest in production today.
    'self_funded', v_self
  );
END;
$$;

-- The surface is reproduced exactly as it stood: anon and authenticated keep
-- EXECUTE because this IS the anonymous guest-capture path (20271114597183 says
-- so in as many words). A CREATE OR REPLACE preserves the existing ACL, so these
-- are belt-and-braces rather than a repair — written anyway, because the day
-- somebody DOES have to drop this function, the grant will be here to copy.
REVOKE ALL ON FUNCTION public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · ASSERTIONS — this migration refuses to apply if it did not do its job
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 THE VALUES ARE DELIBERATELY PULLED APART. A ceiling of 20 against a
-- purchase of 50: any answer that confuses the two ledgers lands on a different
-- number, so a test where the right and wrong answers coincide cannot happen
-- here. (That trap already bit this stream once, at 500 credits.)
DO $$
DECLARE
  v_overloads INTEGER;
  v_def       TEXT;
  v_event     UUID;
  v_guest     UUID;
  v_seat      UUID;
  v_order     UUID;
  r           JSONB;
  i           INTEGER;
BEGIN
  -- ── structural ───────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_overloads
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_record_guest_capture';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION
      'papic_record_guest_capture has % overloads — a named call resolves to none of them (42725) and the route''s fallback ladder degrades every clip to a photo',
      v_overloads;
  END IF;

  v_def := pg_get_functiondef(
    'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer)'::regprocedure);
  IF v_def NOT LIKE '%papic_guest_spend_ceiling(%' THEN
    RAISE EXCEPTION 'the gate no longer consults papic_guest_spend_ceiling — the ceiling would govern nothing';
  END IF;
  IF v_def NOT LIKE '%papic_guest_ceiling_spend%' THEN
    RAISE EXCEPTION 'the gate no longer meters through papic_guest_ceiling_spend — a guest''s own credits would be eaten by the couple''s limit again';
  END IF;

  -- ⛔ THE FUNDING SOURCE MUST NOT BE REACHABLE FROM THE ARGUMENT LIST. The
  -- whole design rests on it being derived; a future parameter named for it
  -- would re-open the walk-through on an anon-callable function.
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace,
           unnest(COALESCE(p.proargnames, ARRAY[]::TEXT[])) AS a(name)
     WHERE n.nspname = 'public'
       AND p.proname = 'papic_record_guest_capture'
       AND a.name ~ '(self_funded|is_mine|own_credits|funding)'
  ) THEN
    RAISE EXCEPTION
      'papic_record_guest_capture grew a caller-supplied funding-source argument — it is anon-callable, so that is a way through the couple''s ceiling entirely';
  END IF;

  IF NOT has_function_privilege('anon',
       'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon lost EXECUTE on papic_record_guest_capture — every guest camera would stop';
  END IF;

  IF has_function_privilege('anon',
       'public.papic_guest_self_funded_spend(uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.papic_guest_self_funded_spend(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'papic_guest_self_funded_spend is reachable by a session role — functions in public ship granted to PUBLIC, the REVOKE was missed';
  END IF;
  IF has_function_privilege('anon',
       'public.papic_guest_ceiling_spend(uuid,integer)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.papic_guest_ceiling_spend(uuid,integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'papic_guest_ceiling_spend is reachable by a session role — the REVOKE was missed';
  END IF;

  -- ── behavioural · a named guest at 20 who bought 50 of her own ───────────
  INSERT INTO public.events (display_name, event_type)
  VALUES ('migration self-check · own credits', 'birthday')
  RETURNING event_id INTO v_event;

  -- A real pot, so the pool applies — the condition under which four previous
  -- limits on this surface went inert.
  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (v_event, 5000, 'admin', 'migration self-check');

  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                             ugc_terms_accepted_at)
  VALUES (v_event, 'Selfcheck', 'Guest', 'both', 'friends', NOW())
  RETURNING guest_id INTO v_guest;

  -- Her own camera, exactly as ensureGuestOwnCameraAdmin mints one.
  INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token,
                                      tier, guest_id)
  VALUES (v_event, 986, 'PAPIC_CAMERA_MINI_DAY',
          translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
          'unlimited', v_guest)
  RETURNING seat_id INTO v_seat;

  -- SHE BOUGHT 50, and chose "keep them for me".
  INSERT INTO public.orders (event_id, description, requested_total_php, reference_code)
  VALUES (v_event, 'migration self-check', 50, 'SELFCHK' || substr(md5(random()::text), 1, 10))
  RETURNING order_id INTO v_order;

  INSERT INTO public.papic_guest_orders
    (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
  VALUES (v_order, v_event, v_seat, v_guest, 'one_reload', 'PAPIC_CAMERA_MINI_DAY', 50,
          translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'));

  INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id, seat_id, note)
  VALUES (v_event, 50, 'topup_order', v_order, v_seat, 'migration self-check');

  -- THE COUPLE NAME HER AT 20.
  UPDATE public.events SET papic_guest_spend_ceiling_on = TRUE WHERE event_id = v_event;
  INSERT INTO public.papic_guest_spend_ceilings (guest_id, event_id, ceiling_points)
  VALUES (v_guest, v_event, 20);

  IF public.papic_guest_spend_ceiling(v_guest) <> 20 THEN
    RAISE EXCEPTION 'PRECONDITION: the named guest''s ceiling did not resolve to 20 — the rest of this check would prove nothing';
  END IF;

  -- 70 captures, each reserved through the SAME split the route uses: the first
  -- 50 come from her own balance, the next 20 from the pot. Not one may be
  -- refused — 20 of the couple's credits is exactly her ceiling.
  FOR i IN 1..70 LOOP
    PERFORM public.papic_reserve_capture_split(v_seat, v_event, 1);
    r := public.papic_record_guest_capture(v_guest, 'r2://selfcheck/' || i, false,
                                           'photo', NULL, NULL, 1);
    IF r->>'status' <> 'ok' THEN
      RAISE EXCEPTION
        'capture % of 70 was refused (%) — a guest who bought 50 of her own must reach her ceiling of 20 ON TOP of them, not inside them. metered=% self_funded=%',
        i, r->>'status', r->>'used', r->>'self_funded';
    END IF;
  END LOOP;

  IF public.papic_guest_self_funded_spend(v_guest) <> 50 THEN
    RAISE EXCEPTION 'she paid for 50 and spent them all, but self-funded spend reads %',
      public.papic_guest_self_funded_spend(v_guest);
  END IF;
  IF public.papic_guest_ceiling_spend(v_guest) <> 20 THEN
    RAISE EXCEPTION 'the ceiling should have metered exactly the 20 pot-funded credits, it reads %',
      public.papic_guest_ceiling_spend(v_guest);
  END IF;

  -- And the 71st — the first that would take a 21st credit out of the pot — is
  -- refused. THE OTHER HALF OF THE PROOF: an exemption with no floor under it
  -- would be a ceiling that never binds, which is the disease, not the cure.
  PERFORM public.papic_reserve_capture_split(v_seat, v_event, 1);
  r := public.papic_record_guest_capture(v_guest, 'r2://selfcheck/71', false,
                                         'photo', NULL, NULL, 1);
  IF r->>'status' <> 'quota_exhausted' OR r->>'reason' <> 'guest_spend_ceiling' THEN
    RAISE EXCEPTION
      'the 21st POT-funded credit must be refused by the couple''s ceiling — got % / %',
      r->>'status', r->>'reason';
  END IF;
  IF (r->>'used')::INTEGER <> 20 OR (r->>'total')::INTEGER <> 20 THEN
    RAISE EXCEPTION
      'the refusal must explain itself in the ceiling''s own currency: used=% total=% (expected 20 / 20)',
      r->>'used', r->>'total';
  END IF;

  -- Clean up the self-check; it must leave no data behind.
  DELETE FROM public.papic_guest_spend_ceilings WHERE event_id = v_event;
  DELETE FROM public.events WHERE event_id = v_event;
  DELETE FROM public.orders WHERE order_id = v_order;
END $$;

COMMIT;
