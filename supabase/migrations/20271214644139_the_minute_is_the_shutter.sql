-- ═══════════════════════════════════════════════════════════════════════════
-- THE MINUTE IS THE SHUTTER, NOT THE UPLOAD
-- Phase 0 · step 0.1 of the by-the-minute story build (design 2026-09-07).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🕐 WHAT IS WRONG TODAY. Both Papic write paths let `captured_at` fall to its
-- column default of now(), so a photograph is filed under the minute its bytes
-- finished arriving. At a venue with patchy signal that is not a small error:
-- a 2 PM photograph lands at 8 PM, and every surface built on that column —
-- the day timeline, the per-minute dial the whole story stands on, the recap
-- selection, the magazine chapters — becomes a chart of WHERE THE RECEPTION
-- HAD SIGNAL rather than of what happened.
--
-- 🔑 THE FIX IS THE SHAPE `p_geo_*` ALREADY USES ON THE SEAT PATH: the value
-- comes from the only thing that knows it (the device that took the picture),
-- and nothing it says is trusted. `papic_capture_minute` below is the whole
-- validation, in one place, consulted by both writers.
--
-- ⚠ IT REFUSES A TIME. IT NEVER REFUSES A PHOTOGRAPH. This is the single most
-- important property in this file. `papic_record_guest_capture` is the
-- authoritative race-safe gate every guest capture at a live wedding goes
-- through; a validation that could RAISE would turn a wrong phone clock into a
-- refused capture at somebody's wedding, in progress, with no way to retry.
-- So every branch of the resolver ends in a value: anything it cannot believe
-- resolves to now(), which is byte-for-byte the behaviour every row already
-- has today. The worst case of this migration is the status quo.
--
-- ⚖ `created_at` IS UNTOUCHED AND STAYS THE UPLOAD MINUTE. The two facts are
-- different facts and both are worth keeping — "when it happened" is the
-- story's spine, "when it landed" is what the offline queue and the ingest
-- diagnostics measure. Nothing that reads created_at changes meaning here.
--
-- 👤 OWNER RULING 2026-09-07, verbatim: "when we get the photos and snippets,
-- we know. but the guest does not need to know." Read on ingest. Never asked,
-- never surfaced. There is no UI in this change and there must never be one.
--
-- ⛔ NOTHING ELSE IN EITHER FUNCTION IS WIDENED. Both bodies below are the
-- deployed definitions read back out of production with pg_get_functiondef on
-- 2026-09-09 and mechanically extended (scripted, with each edit asserted to
-- match exactly once) at exactly three points each: the new last argument, one
-- new local, and `captured_at` on the INSERT. Every gate, every comment and
-- every reply field is the shipped text.
--
-- 🪤 DROP-THEN-CREATE, NOT AN OVERLOAD, and 20271184624871 paid for that lesson
-- in production: with two arities both fully defaulted, a named call fails
-- 42725 "function is not unique" — AND the guest route's signature-fallback
-- ladder matches that error with /function .*papic_record_guest_capture/, so it
-- would quietly retry a shorter shape and record every clip as a photo. One
-- function, one gate. The DROPs below name the exact deployed signatures.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · THE RESOLVER — one rule, both writers
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.papic_capture_minute(
  p_event_id UUID,
  p_claimed  TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created TIMESTAMPTZ;
BEGIN
  -- ABSENT → the upload minute. An old deploy that has not learned the argument,
  -- the dashboard's add-to-library import and the DSLR bridge all land here, and
  -- all of them keep exactly the behaviour they have today.
  IF p_claimed IS NULL THEN
    RETURN now();
  END IF;

  -- A SHUTTER CANNOT BE IN THE FUTURE. Two minutes of tolerance for a phone
  -- whose clock runs a little fast — beyond that the value is not a capture
  -- time, it is a wrong clock or a crafted argument, and either way the honest
  -- answer is the one instant we can prove: this one.
  IF p_claimed > now() + INTERVAL '2 minutes' THEN
    RETURN now();
  END IF;

  SELECT created_at INTO v_created
    FROM public.events
   WHERE event_id = p_event_id;

  -- No event row. Both callers resolved one to reach this line, so this is
  -- unreachable in practice; it exists so the resolver has no path that returns
  -- NULL into a NOT NULL column.
  IF v_created IS NULL THEN
    RETURN now();
  END IF;

  -- ⚖ THE LOWER BOUND IS THE EVENT'S OWN BIRTH, NOT ITS DAY, and the difference
  -- is the whole reason this is not a one-line "clamp to the event date". The
  -- story is built on pre-day captures — a prenup, a despedida, the ring being
  -- collected — and those are legitimately MONTHS before the event date while
  -- always AFTER the celebration was created on Setnayan. Clamping to the day
  -- would move every one of them to the upload minute and quietly wreck the
  -- road-to-the-day segments the dial draws. Clamping to creation still catches
  -- the failure that actually happens: a device sitting at the 1970 epoch, or
  -- one a guest has set a year forward. One day of grace absorbs clock skew.
  IF p_claimed < v_created - INTERVAL '1 day' THEN
    RETURN now();
  END IF;

  RETURN p_claimed;
END;
$$;

-- Callable by the two SECURITY DEFINER writers (both owned by postgres, so the
-- nested call is made as the owner) and by service_role. Not by a session role:
-- there is no reason for anon or authenticated to ask this question directly,
-- and an ungranted door is one that cannot be pushed on.
REVOKE ALL ON FUNCTION public.papic_capture_minute(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_capture_minute(UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.papic_capture_minute(UUID, TIMESTAMPTZ) IS
  'Resolve a client-claimed shutter time to the minute a Papic capture is filed under. Returns now() for anything it cannot believe (absent, in the future, or before the event existed) and NEVER raises — a wrong clock must never refuse a photograph.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · THE GUEST WRITER — the deployed body, plus the shutter
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT);

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
  p_captured_at       TIMESTAMPTZ DEFAULT NULL
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
    media_type, duration_ms, poster_r2_key, points_cost, captured_at
  )
  VALUES (
    v_event_id, p_guest_id, p_r2_object_key, COALESCE(p_consent_to_public, false),
    v_media, v_duration, NULLIF(btrim(COALESCE(p_poster_r2_key, '')), ''), v_cost, v_minute
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
$function$
;

-- The surface is reproduced exactly as it stood before the DROP (measured on
-- prod 2026-09-09: anon, authenticated, service_role, plus the owner). anon
-- keeps EXECUTE because this IS the anonymous guest-capture path.
REVOKE ALL ON FUNCTION
  public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · THE SEAT WRITER — the deployed body, plus the shutter
-- ═══════════════════════════════════════════════════════════════════════════
-- The seat path is where the minute is dropped TODAY in the most visible way:
-- papic-sink.ts hands `deps.record(...)` three arguments and CapturedFile's own
-- `capturedAtMs` — the DSLR's real shutter — is not one of them.
DROP FUNCTION IF EXISTS public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN);

CREATE OR REPLACE FUNCTION public.papic_record_seat_capture(
  p_seat_id          UUID,
  p_event_id         UUID,
  p_claimer_user_id  UUID,
  p_r2_object_key    TEXT,
  p_photo_type       TEXT DEFAULT 'photo',
  p_poster_r2_key    TEXT DEFAULT NULL,
  p_cost             INT DEFAULT 0,
  p_geo_lat          DOUBLE PRECISION DEFAULT NULL,
  p_geo_lon          DOUBLE PRECISION DEFAULT NULL,
  p_geo_accuracy_m   DOUBLE PRECISION DEFAULT NULL,
  p_geo_unavailable  BOOLEAN DEFAULT NULL,
  -- 🕐 THE SHUTTER — the same client-supplied / server-validated shape the
  -- p_geo_* arguments above already use, and for the same reason: only the
  -- device that took the picture knows, and nothing it says is trusted.
  p_captured_at      TIMESTAMPTZ DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_seat_event    UUID;
  v_seat_claimer  UUID;
  v_revoked_at    TIMESTAMPTZ;
  v_type          TEXT;
  v_poster        TEXT;
  v_key           TEXT;
  v_ok            BOOLEAN;
  v_dedicated     INTEGER := 0;
  v_pool          INTEGER := 0;
  v_photo_id      UUID;
  v_minute        TIMESTAMPTZ;
BEGIN
  v_key := NULLIF(btrim(COALESCE(p_r2_object_key, '')), '');
  IF p_seat_id IS NULL OR p_event_id IS NULL OR p_claimer_user_id IS NULL
     OR v_key IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;

  -- Normalize the kind. Anything that is not the literal 'clip' is a photo, so a
  -- malformed caller can never trip the CHECK constraint — the same normalization
  -- papic_record_guest_capture does for `p_media_type`.
  v_type   := CASE WHEN p_photo_type = 'clip' THEN 'clip' ELSE 'photo' END;
  -- A poster frame is the NSFW screen's proxy for a video. It is meaningless on a
  -- still, and a still carrying one would be screened against the wrong image.
  v_poster := CASE
    WHEN v_type = 'clip' THEN NULLIF(btrim(COALESCE(p_poster_r2_key, '')), '')
    ELSE NULL
  END;

  -- ── AUTHORIZATION, DONE HERE AND NOT ONLY UPSTAIRS ────────────────────────
  -- The action already resolves the seat under the claimer's own session, where
  -- RLS scopes the lookup. This asks the same three questions again against the
  -- row, because a SECURITY DEFINER function that trusts its arguments is a
  -- function whose only fence is the discipline of its callers.
  SELECT event_id, claimer_user_id, revoked_at
    INTO v_seat_event, v_seat_claimer, v_revoked_at
    FROM public.paparazzi_seats
   WHERE seat_id = p_seat_id;

  IF v_seat_event IS NULL THEN
    RETURN jsonb_build_object('status', 'not_your_seat');
  END IF;
  -- CROSS-EVENT GUARD, the same one papic_reserve_capture_split carries: a seat
  -- id is not a capability, so naming one event's camera while charging another
  -- event's pot is refused rather than merely unlikely.
  IF v_seat_event <> p_event_id THEN
    RETURN jsonb_build_object('status', 'not_your_seat');
  END IF;
  IF v_seat_claimer IS NULL OR v_seat_claimer <> p_claimer_user_id THEN
    RETURN jsonb_build_object('status', 'not_your_seat');
  END IF;
  IF v_revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  -- ── THE METER ─────────────────────────────────────────────────────────────
  -- p_cost = 0 means "this capture is not metered" — an event holding the Papic
  -- Unlock pass, or a legacy PAPIC_SEATS pack seat, both of which skip the
  -- reserve upstairs today. Expressed as a cost of zero rather than a boolean so
  -- there is exactly one number describing what this capture is worth.
  IF COALESCE(p_cost, 0) > 0 THEN
    SELECT r.ok, r.dedicated_spent, r.pool_spent
      INTO v_ok, v_dedicated, v_pool
      FROM public.papic_reserve_capture_split(p_seat_id, p_event_id, p_cost) AS r;

    -- The split returns FALSE having spent NOTHING when the pot cannot cover the
    -- remainder — its own comment explains why the refusable leg runs first. So
    -- an exhausted answer needs no unwind, here or above.
    IF NOT COALESCE(v_ok, FALSE) THEN
      RETURN jsonb_build_object('status', 'exhausted');
    END IF;
  END IF;

  -- ── THE ROW ───────────────────────────────────────────────────────────────
  -- 🔑 THIS IS THE WHOLE POINT OF THE FUNCTION. The reserve above has already
  -- moved two balances. If this INSERT raises — a constraint, a revoked grant, a
  -- lost connection mid-statement — the transaction rolls back and both balances
  -- go with it. There is no window in which credits are spent and no photograph
  -- exists, and therefore nothing left for an application unwind to do.
  --
  -- geo: passing NULL for every geo argument writes exactly what "the privacy
  -- control is off" wrote before — NULLs, and `geo_unavailable` at its column
  -- default of FALSE. The decision itself stays in buildPapicGeoFields, which is
  -- the one place the RA 10173 rule is expressed.
  --
  -- `expires_at` is not an argument. Captures are uncapped and permanent; the
  -- retired free sampler was the only path that ever set an expiry, and giving
  -- this function a handle for it would be inventing a rule nothing asks for.
  -- 🕐 Resolved AFTER the reserve, on the same principle as the guest path: an
  -- unbelievable clock costs the shot its exact minute, never the shot.
  v_minute := public.papic_capture_minute(p_event_id, p_captured_at);

  INSERT INTO public.papic_photos (
    event_id, paparazzi_seat_id, r2_object_key, photo_type, poster_r2_key,
    geo_lat, geo_lon, geo_accuracy_m, geo_unavailable, captured_at
  )
  VALUES (
    p_event_id, p_seat_id, v_key, v_type, v_poster,
    p_geo_lat, p_geo_lon, p_geo_accuracy_m, COALESCE(p_geo_unavailable, FALSE), v_minute
  )
  RETURNING photo_id INTO v_photo_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'photo_id', v_photo_id,
    -- Returned for observability only. NOTHING should unwind these: they are
    -- committed with the row or they never happened.
    'dedicated_spent', COALESCE(v_dedicated, 0),
    'pool_spent', COALESCE(v_pool, 0)
  );
END;
$function$
;

-- Service-role only, exactly as it stood before the DROP (measured on prod
-- 2026-09-09). A session role holding EXECUTE here would walk past the five
-- gates that live in the server action above it.
REVOKE ALL ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, TIMESTAMPTZ) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, TIMESTAMPTZ) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · ASSERTIONS — this migration refuses to apply if it did not do its job
-- ═══════════════════════════════════════════════════════════════════════════
-- Each of these is a way this exact change could look applied and be inert: a
-- surviving overload, a lost grant, a body that no longer consults the
-- resolver, a resolver that believes a future clock. A comment asking a future
-- session to remember is a sentence; this is a mechanism.
DO $$
DECLARE
  v_n     INTEGER;
  v_def   TEXT;
  v_event UUID;
  v_got   TIMESTAMPTZ;
BEGIN
  -- ONE writer, ONE gate — the 42725 trap of 20271184624871.
  SELECT COUNT(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_record_guest_capture';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'papic_record_guest_capture has % overloads — a named call resolves to none of them (42725) and the route''s fallback ladder degrades every clip to a photo', v_n;
  END IF;
  SELECT COUNT(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_record_seat_capture';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'papic_record_seat_capture has % overloads', v_n;
  END IF;

  -- The argument exists, on both, and is the LAST one (so every existing
  -- positional caller keeps its meaning).
  IF pg_get_function_identity_arguments(
       'public.papic_record_guest_capture'::regproc)
     NOT LIKE '%, p_captured_at timestamp with time zone' THEN
    RAISE EXCEPTION 'papic_record_guest_capture did not gain p_captured_at as its last argument';
  END IF;
  IF pg_get_function_identity_arguments(
       'public.papic_record_seat_capture'::regproc)
     NOT LIKE '%, p_captured_at timestamp with time zone' THEN
    RAISE EXCEPTION 'papic_record_seat_capture did not gain p_captured_at as its last argument';
  END IF;

  -- THE ARGUMENT REACHES THE ROW. A parameter that is accepted and dropped on
  -- the floor is the failure this whole migration exists to end, and it is
  -- invisible from the signature alone.
  FOR v_def IN
    SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('papic_record_guest_capture', 'papic_record_seat_capture')
  LOOP
    IF v_def NOT LIKE '%papic_capture_minute%' THEN
      RAISE EXCEPTION 'a Papic writer does not consult papic_capture_minute — its p_captured_at is decoration';
    END IF;
    IF v_def NOT LIKE '%captured_at%' THEN
      RAISE EXCEPTION 'a Papic writer does not write captured_at — the row still falls to the upload minute';
    END IF;
  END LOOP;

  -- THE GRANTS. Every one of these was measured on prod before the DROP; a
  -- DROP silently takes them with it, and the only symptom of a missing grant
  -- is an absence.
  IF NOT has_function_privilege('anon',
       'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'papic_record_guest_capture lost a grant across the DROP — the guest camera is dead on the next deploy';
  END IF;
  IF NOT has_function_privilege('service_role',
       'public.papic_record_seat_capture(uuid,uuid,uuid,text,text,text,integer,double precision,double precision,double precision,boolean,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'papic_record_seat_capture lost service_role EXECUTE across the DROP — every seat capture would 42501';
  END IF;
  IF has_function_privilege('anon',
       'public.papic_record_seat_capture(uuid,uuid,uuid,text,text,text,integer,double precision,double precision,double precision,boolean,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.papic_record_seat_capture(uuid,uuid,uuid,text,text,text,integer,double precision,double precision,double precision,boolean,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'papic_record_seat_capture became callable by a session role — that walks past all five gates in the server action';
  END IF;

  -- THE RESOLVER ACTUALLY RESOLVES. Asked against a real event so the
  -- created_at leg is exercised, not just the two cheap ones. Skipped only on a
  -- database with no events at all (a fresh replay).
  SELECT event_id INTO v_event FROM public.events ORDER BY created_at LIMIT 1;
  IF v_event IS NOT NULL THEN
    IF public.papic_capture_minute(v_event, NULL) IS NULL THEN
      RAISE EXCEPTION 'papic_capture_minute returned NULL for an absent claim — that is a NOT NULL violation on every legacy caller';
    END IF;
    v_got := public.papic_capture_minute(v_event, now() + INTERVAL '3 days');
    IF v_got > now() + INTERVAL '2 minutes' THEN
      RAISE EXCEPTION 'papic_capture_minute believed a shutter time in the future';
    END IF;
    v_got := public.papic_capture_minute(v_event, TIMESTAMPTZ '1970-01-01 00:00:00+00');
    IF v_got < now() - INTERVAL '1 hour' THEN
      RAISE EXCEPTION 'papic_capture_minute believed a 1970 epoch clock';
    END IF;
    -- And it BELIEVES a believable one. Without this leg every assertion above
    -- would still pass for a resolver that returned now() unconditionally —
    -- which is precisely the bug being fixed.
    v_got := public.papic_capture_minute(v_event, now() - INTERVAL '6 hours');
    IF v_got > now() - INTERVAL '5 hours' THEN
      RAISE EXCEPTION 'papic_capture_minute overwrote a believable shutter time — captures still land on the upload minute';
    END IF;
  END IF;
END;
$$;
