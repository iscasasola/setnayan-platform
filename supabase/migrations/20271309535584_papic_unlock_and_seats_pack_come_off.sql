-- 20271309535584 · the Papic Unlock pass and the PAPIC_SEATS pack come off
--
-- Owner, 2026-11-05, asked whether anybody still holds the old "Unlock all of
-- Papic" pass or the legacy PAPIC_SEATS pack: "no one. remove both". Both were
-- already off sale (the two Unlock bundles deactivated in 20271171000513, the
-- PAPIC_SEATS catalogue row deleted in 20271179454449). What was left is what
-- they still DID for an event that held one, and each of those made a shot free
-- or lifted a limit:
--
--   1 · papic_record_guest_capture: an active PAPIC_UNLOCK order set
--       v_unlimited, lifting the per-guest 150. Re-created below with that
--       lookup removed and NOTHING else changed. The body is copied from
--       20271272777206 (the latest definition): same signature, same grants.
--       The pot's own yield stays: the per-guest number still stands down on a
--       celebration whose shared pot applies, unless the couple set a ceiling
--       on this guest.
--   2 · papic_event_pool_config.pass_service_codes listed both Unlock codes as
--       "flat passes", which gave a holder a pool sized by head count. Emptied,
--       and its default with it, so papic_event_has_flat_pass is FALSE
--       everywhere.
--   3 · papic_provision_seats minted the PAPIC_SEATS pack's five seats. Its only
--       caller (a studio server action with no screen) is deleted in the same
--       PR, so the function goes too.
--
-- The seat-capture side (a pack seat or an Unlock event recording at cost 0)
-- is app code (app/papic/actions.ts, app/api/upload/route.ts) and changes in
-- the same PR. No table is dropped; no order, payment or seat row is touched.

-- ── 1 · the guest capture stops asking about the Unlock pass ─────────────────
CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id          UUID,
  p_r2_object_key     TEXT DEFAULT NULL,
  p_consent_to_public BOOLEAN DEFAULT false,
  p_media_type        TEXT DEFAULT 'photo',
  p_duration_ms       INT DEFAULT NULL,
  p_poster_r2_key     TEXT DEFAULT NULL,
  p_points_cost       INT DEFAULT 1,
  -- 🕐 THE SHUTTER, CLIENT-SUPPLIED AND SERVER-VALIDATED. Last, defaulted NULL,
  -- so an old deploy's 7-argument named call lands here unchanged and records
  -- the upload minute exactly as it did before.
  p_captured_at       TIMESTAMPTZ DEFAULT NULL,
  -- 🔁 THE SHUTTER'S OWN ID, minted by the guest's phone at the grab and sent
  -- again, unchanged, by every retry and by the offline queue. Last, defaulted
  -- NULL, so a caller that sends none records exactly as before (L1·2).
  p_client_capture_id UUID DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits   CONSTANT INTEGER := 150;
  v_event_id  UUID;
  v_terms_at  TIMESTAMPTZ;
  v_blocked   BOOLEAN;
  v_owns      BOOLEAN;
  v_unlimited BOOLEAN;
  v_used      INTEGER;
  v_allowance INTEGER;
  v_media     TEXT;
  v_duration  INT;
  v_pool_applies BOOLEAN;
  v_ceiling   INTEGER;
  v_cost      INTEGER;
  v_metered   INTEGER;
  v_self      INTEGER;
  v_minute    TIMESTAMPTZ;
  v_prior     UUID;
  v_capture   UUID;
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

  -- 🛑 THE "UNLOCK ALL OF PAPIC" PASS NO LONGER LIFTS ANYTHING (owner 2026-11-05:
  -- "no one. remove both"). It used to: an active PAPIC_UNLOCK order set
  -- v_unlimited here. The pass is off sale and nobody holds one, so the only
  -- thing that can lift the per-guest number now is the shared pot, below.

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
  v_unlimited := (COALESCE(v_pool_applies, FALSE) AND v_ceiling IS NULL);

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check. hashtextextended → bigint
  -- lock key scoped to this transaction. ONE gate inside ONE lock — a second
  -- gate in sequence after it could not be race-safe.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  -- 🔁 ONE SHUTTER, ONE ROW, ONE SPEND (event-day L1·2, 20271272777206). A
  -- retry after a lost answer — the phone never heard "saved", so it sends the
  -- same shot again, live or from its offline queue — carries the SAME client
  -- id. Asked HERE, inside the guest's lock and BEFORE every meter below, so a
  -- second arrival is answered with the first row and charges nothing: no
  -- second row, no second ceiling spend. A racing duplicate waits on the lock
  -- above and then sees the committed first. The reply is the success reply,
  -- marked `duplicate`, so the caller can put back the pool points it booked.
  IF p_client_capture_id IS NOT NULL THEN
    SELECT capture_id INTO v_prior
      FROM public.papic_guest_captures
     WHERE guest_id = p_guest_id
       AND client_capture_id = p_client_capture_id;
    IF v_prior IS NOT NULL THEN
      SELECT COALESCE(SUM(points_cost), 0)::INTEGER INTO v_used
        FROM public.papic_guest_captures
       WHERE guest_id = p_guest_id;
      v_self := public.papic_guest_self_funded_spend(p_guest_id);
      IF v_ceiling IS NOT NULL THEN
        v_metered := public.papic_guest_ceiling_spend(p_guest_id);
      END IF;
      RETURN jsonb_build_object(
        'status', 'ok',
        'duplicate', true,
        'capture_id', v_prior,
        'total', COALESCE(v_ceiling, v_credits),
        'used', CASE WHEN v_ceiling IS NOT NULL THEN v_metered ELSE v_used END,
        'remaining', CASE
          WHEN v_ceiling IS NOT NULL THEN GREATEST(0, v_ceiling - v_metered)
          WHEN v_unlimited THEN v_credits
          ELSE GREATEST(0, v_credits - v_used)
        END,
        'unlimited', (v_unlimited AND v_ceiling IS NULL),
        'ceiling', v_ceiling,
        'self_funded', v_self
      );
    END IF;
  END IF;

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
  -- shared pot standing our limit down is not permission to walk through the
  -- limit the couple themselves set on one guest.
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

  -- 🔑 150 IS THE RECOMMENDED CAP, NOT A HARD ONE (owner, 2026-08-31: "yes it is
  -- raisable. but that is the recommended cap. if cap is activated").
  --
  -- Before this migration a couple could activate the ceiling, set 300, and their
  -- guests were still refused at 150 — the product broke a promise the couple had
  -- made in its own UI, and the refusal reported 150 rather than their figure.
  --
  -- So the flat number becomes a FLOOR that the couple's ACTIVATED cap may raise,
  -- never a lid over it. Three cases, all covered by one GREATEST:
  --   • no ceiling activated  → v_ceiling IS NULL → allowance = 150, exactly as before,
  --     which is every celebration that sets nothing (the default).
  --   • ceiling BELOW 150     → the ceiling's own gate above has already refused;
  --     raising this floor cannot loosen it, because that gate binds first.
  --   • ceiling ABOVE 150     → the couple's figure governs, which is the fix.
  --
  -- ⚠ This still does NOT care who paid — it is the per-phone deposit guard, and
  -- `v_used` is deliberately every credit she has spent from any ledger (see above).
  -- Raising the guard is the owner's call; weakening what it measures is not.
  v_allowance := GREATEST(v_credits, COALESCE(v_ceiling, 0));

  IF NOT v_unlimited AND (v_used + v_cost) > v_allowance THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'reason', 'per_guest_credits',
      'total', v_allowance,
      'used', v_used,
      'remaining', GREATEST(0, v_allowance - v_used)
    );
  END IF;

  -- 🕐 THE MINUTE IS THE SHUTTER, NOT THE UPLOAD. Resolved here, AFTER every
  -- gate above has passed, so a bad clock can never be the reason a photograph
  -- is refused: papic_capture_minute returns now() for anything it cannot
  -- believe and never raises. `created_at` keeps its default and stays the
  -- upload minute, so nothing that measures ingest loses its clock.
  v_minute := public.papic_capture_minute(v_event_id, p_captured_at);

  INSERT INTO public.papic_guest_captures (
    event_id, guest_id, r2_object_key, consent_to_public,
    media_type, duration_ms, poster_r2_key, points_cost, captured_at,
    client_capture_id
  )
  VALUES (
    v_event_id, p_guest_id, p_r2_object_key, COALESCE(p_consent_to_public, false),
    v_media, v_duration, NULLIF(btrim(COALESCE(p_poster_r2_key, '')), ''), v_cost, v_minute,
    p_client_capture_id
  )
  RETURNING capture_id INTO v_capture;

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
    'duplicate', false,
    'capture_id', v_capture,
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
$function$
;

-- The surface is reproduced exactly as it stood before the DROP (anon,
-- authenticated, service_role). anon keeps EXECUTE because this IS the
-- anonymous guest-capture path.
REVOKE ALL ON FUNCTION
  public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID)
  TO anon, authenticated, service_role;

-- ── 2 · no flat pass any more ───────────────────────────────────────────────
UPDATE public.papic_event_pool_config
   SET pass_service_codes = ARRAY[]::TEXT[]
 WHERE pass_service_codes IS DISTINCT FROM ARRAY[]::TEXT[];

ALTER TABLE public.papic_event_pool_config
  ALTER COLUMN pass_service_codes SET DEFAULT ARRAY[]::TEXT[];

-- ── 3 · the pack's provisioning RPC ─────────────────────────────────────────
-- Not CASCADE: an unexpected dependant fails the push loudly.
DROP FUNCTION IF EXISTS public.papic_provision_seats(UUID);

-- ── checks: refuse to apply if any of it did not land ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'papic_record_guest_capture'
       AND p.prosrc LIKE '%service_key = ''PAPIC_UNLOCK''%'
  ) THEN
    RAISE EXCEPTION 'papic_record_guest_capture still reads the Unlock pass';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.papic_event_pool_config
     WHERE config_key = 'default'
       AND cardinality(pass_service_codes) > 0
  ) THEN
    RAISE EXCEPTION 'a flat pass is still configured';
  END IF;
  IF to_regprocedure('public.papic_provision_seats(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'papic_provision_seats still exists';
  END IF;
END;
$$;
