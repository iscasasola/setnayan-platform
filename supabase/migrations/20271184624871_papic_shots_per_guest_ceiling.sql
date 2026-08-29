-- ═══════════════════════════════════════════════════════════════════════════
-- HOW MANY CREDITS ONE GUEST MAY SPEND — and the limit becomes real
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-08-28: *"this is a good idea to help them decide how many shots
-- per guest they can have. the excess can always be used by anyone or dedicated
-- to someone."* Then, second pass: *"we can allot specific numbers for each
-- guest. but also allow for the rest to share the other shots equally, and the
-- excess can be used by anyone."*
--
-- Build spec: WHATS_NEXT_Shots_Per_Guest_2026-08-28.md §§ 2–5 + § 7a/7c/7d.
-- This is session S2 of six: the STORAGE, the stored per-capture cost, the GATE
-- and the RELEASE. The couple's control (S3) and the guest's counter (S4) are
-- separate changes and neither can ship before this one — *gate the write, not
-- the button*.
--
-- ── ⚠ THE VOCABULARY, AND WHY THESE NAMES AND NOT SHORTER ONES ─────────────
-- The currency a customer reads is a CREDIT (owner 2026-08-29, commit
-- 32df56e81); the SCHEMA has said `points` 164 times since long before that and
-- keeps saying it here. A photograph is still a "shot" in English and that word
-- is deliberately absent from every identifier below.
--
-- 🪤 AND ONE COLLISION WAS ALREADY WAITING. `papic_event_pool_config
-- .points_per_guest` (DEFAULT 150) IS A SHIPPED COLUMN AND IT IS NOT THIS. It
-- sizes the POT from headcount — `clamp(guests × points_per_guest, floor,
-- ceiling)` — i.e. *credits the pot GAINS per head*. What this migration adds is
-- *credits one guest may SPEND*. Two different facts. Naming this one
-- `points_per_guest` would have been one rule written twice under one name,
-- which is the exact disease this whole build exists to cure — so everything
-- here says `guest_spend_ceiling`, which cannot be misread as the other.
--
-- 🔑 The 150 being made real here is the SAME 150 that sizes the pool. They are
-- allowed to differ, but never silently: if one moves, look at the other.
--
-- ── WHAT THIS IS, IN ONE LINE ──────────────────────────────────────────────
-- A CEILING, NOT A RESERVATION. Nothing is carved out of the pot; no guest holds
-- a wallet; unspent credits stay shared. Capping everybody IS the guarantee —
-- if every other guest is capped at their own share, none of them can reach
-- yours, and the arithmetic does the reserving.
--
-- ⛔ It must not share machinery with dedicated credits. `papic_dedicate_shots`
-- moves credits onto a camera and is a FLOOR (owner-locked 2026-08-11,
-- tests/db/papic-dedicated-is-a-floor.db.test.ts). This is the opposite
-- semantic, so it gets its own table and its own words.
--
-- ── DEFAULT OFF, AND THAT IS THE SAFETY ARGUMENT ───────────────────────────
-- `papic_guest_spend_ceiling_on` defaults FALSE, so on the day this applies NO
-- celebration has a ceiling, the resolver returns NULL after one indexed read,
-- and the capture path behaves exactly as it did. The gate is inert on merge.
--
-- ── 🚨 THE ONE LIVE BEHAVIOUR CHANGE, STATED OUT LOUD ──────────────────────
-- The per-guest meter counted ROWS and now sums CREDITS. It was already called
-- "150 credits" while counting rows, and a ten-second clip costs 8 — so a row
-- count was never the thing the constant named. Measured exposure: the legacy
-- 150 branch is reached only on an event where NO pool applies and no
-- PAPIC_UNLOCK order exists, and every event arms the free 50-credit pool grant
-- on render, so that branch is inert in practice. `used` / `remaining` in the
-- RPC's reply are credit-denominated from here on; the guest camera's copy still
-- says "photos" and that is S4's change, not this one.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · WHERE THE COUPLE'S CHOICE LIVES — three columns on `events`
-- ═══════════════════════════════════════════════════════════════════════════
-- Every couple-set per-event Papic choice already lives here (papic_window_*,
-- papic_style, papic_uploads_open, papic_guest_capture_early), so this follows
-- rather than invents.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_guest_spend_ceiling_on          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS papic_guest_spend_ceiling_points      INTEGER,
  ADD COLUMN IF NOT EXISTS papic_guest_spend_ceiling_released_at TIMESTAMPTZ;

-- "A blank box is not zero" is enforced at the far end by the control (S3); this
-- is the end that cannot be talked round. NULL means *derive the equal share*,
-- and a stored 0 would mean *nobody may shoot*, which is what the capture window
-- is for — so 0 cannot be stored at all.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.events'::regclass
       AND conname  = 'events_papic_guest_spend_ceiling_points_positive'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_papic_guest_spend_ceiling_points_positive
      CHECK (papic_guest_spend_ceiling_points IS NULL
             OR papic_guest_spend_ceiling_points > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.events.papic_guest_spend_ceiling_on IS
  'Is there a per-guest spending ceiling on this celebration? Owner 2026-08-28. '
  'Defaults FALSE — a ceiling hands a RESTRICTION to other people and a '
  'celebration must never quietly acquire one (same reasoning as '
  'papic_guest_capture_early). FALSE short-circuits papic_guest_spend_ceiling() '
  'before any further read, which is what keeps the capture path unchanged for '
  'every event that has not asked for this.';

COMMENT ON COLUMN public.events.papic_guest_spend_ceiling_points IS
  'How many CREDITS one ordinary guest may spend, when the couple typed a '
  'number. NULL = derive an equal share of what is left after the named guests '
  '(tier 2). ⚠ THIS IS NOT papic_event_pool_config.points_per_guest, which sizes '
  'the POT from headcount and defaults to 150. That one is credits the pot '
  'GAINS per head; this one is credits a guest may SPEND. Never fold them.';

COMMENT ON COLUMN public.events.papic_guest_spend_ceiling_released_at IS
  'When the couple pressed "open the rest to everyone" (owner 7a). Non-NULL '
  'lifts tiers 2 and 3 — the equal share and the excess. It NEVER lifts a named '
  'guest''s own ceiling (owner 7c): naming somebody means her credits wait for '
  'her all night. The release also happens by itself in the celebration''s last '
  'stretch — see papic_guest_spend_ceiling().';

-- ── THE GRANT, AND WHY A COLUMN ON THIS TABLE IS NOT DONE WHEN IT EXISTS ────
--
-- 🚨 `events` REVOKES TABLE-LEVEL SELECT AND RE-GRANTS A PER-COLUMN ALLOWLIST.
-- An ungranted column is not merely unreadable — PostgREST refuses the WHOLE
-- query, so every surface reading `events` through a user session goes silently
-- empty. `scripts/lint-events-column-grants.mjs` is the ONLY thing that catches
-- a miss: the db coverage tests structurally cannot, because their `before()`
-- re-applies the lockdown and recomputes the allowlist over the new column.
-- Precedent with both halves written out: 20271170068924_papic_uploads_open.sql.
--
-- SELECT + UPDATE, no INSERT: none of the three is answered when a celebration
-- is minted. `anon` gets nothing — what a couple has decided about their guests'
-- allowances is not a signed-out visitor's business.
GRANT SELECT (papic_guest_spend_ceiling_on)          ON public.events TO authenticated;
GRANT UPDATE (papic_guest_spend_ceiling_on)          ON public.events TO authenticated;
GRANT SELECT (papic_guest_spend_ceiling_points)      ON public.events TO authenticated;
GRANT UPDATE (papic_guest_spend_ceiling_points)      ON public.events TO authenticated;
GRANT SELECT (papic_guest_spend_ceiling_released_at) ON public.events TO authenticated;
GRANT UPDATE (papic_guest_spend_ceiling_released_at) ON public.events TO authenticated;

-- ── AND THE HOST VIEW HAS TO BE REBUILT WITH THEM ──────────────────────────
-- `events_host` has an EXPLICIT column projection computed from the grants
-- above, so a new column is a PHANTOM COLUMN on it until the view is rebuilt —
-- and /dashboard/[eventId]/details THROWS on a query error, which would kill
-- Personalization for every host on every event type.
DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  -- The projection is derived from the GRANTs above, so this asserts they took
  -- rather than assuming it. All three, named individually — a loop over a list
  -- would pass on the first and say nothing about the other two.
  IF projected NOT LIKE '%papic_guest_spend_ceiling_on%' THEN
    RAISE EXCEPTION 'refusing to apply: papic_guest_spend_ceiling_on missing from the events_host projection — its GRANT did not take';
  END IF;
  IF projected NOT LIKE '%papic_guest_spend_ceiling_points%' THEN
    RAISE EXCEPTION 'refusing to apply: papic_guest_spend_ceiling_points missing from the events_host projection — its GRANT did not take';
  END IF;
  IF projected NOT LIKE '%papic_guest_spend_ceiling_released_at%' THEN
    RAISE EXCEPTION 'refusing to apply: papic_guest_spend_ceiling_released_at missing from the events_host projection — its GRANT did not take';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · THE GUESTS THE COUPLE NAMES — tier 1
-- ═══════════════════════════════════════════════════════════════════════════
-- Shaped on papic_seat_allocations: ONE row per guest holding the CURRENT
-- amount, not a log of moves, so "set this guest to 40" applied twice is 40.
--
-- ⚠ SHAPED ON IT, NOT NAMED AFTER IT. An *allocation* MOVES credits out of the
-- shared pot onto a camera and is a floor. A row here moves NOTHING: it is a
-- ceiling on what one person may spend out of the pot everyone shares. Calling
-- this table `papic_guest_allocations` would have invited exactly the confusion
-- the dedicated-is-a-floor lock exists to prevent.
CREATE TABLE IF NOT EXISTS public.papic_guest_spend_ceilings (
  guest_id       UUID PRIMARY KEY REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  ceiling_points INTEGER NOT NULL DEFAULT 0 CHECK (ceiling_points >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS papic_guest_spend_ceilings_event_idx
  ON public.papic_guest_spend_ceilings(event_id);

COMMENT ON TABLE public.papic_guest_spend_ceilings IS
  'How many CREDITS one NAMED guest may spend at this celebration. ONE row per '
  'guest holding the CURRENT figure — not a log of moves, which is what makes '
  '"set her to 40" idempotent. ⚠ A row here MOVES NOTHING out of the shared pot: '
  'it is a ceiling, not a reservation, and the opposite semantic to '
  'papic_seat_allocations (a floor). Zero is a legitimate figure and means this '
  'guest may not spend. Read only through papic_guest_spend_ceiling(); never by '
  'a capture path directly.';

-- Every table in `public` ships OPEN — the default ACL grants arwdDxtm to anon
-- and authenticated. RLS at CREATE TABLE time AND an explicit REVOKE, both. No
-- policy on purpose: written only by the SECURITY DEFINER setter below, read
-- only through the resolver. A guest editing their own ceiling is precisely what
-- the fence is for — the posture papic_seat_allocations ships with.
ALTER TABLE public.papic_guest_spend_ceilings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.papic_guest_spend_ceilings FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · WHAT A CAPTURE COST, STORED ON THE CAPTURE
-- ═══════════════════════════════════════════════════════════════════════════
-- The meter has to be in CREDITS, and rows are not credits — a ten-second clip
-- costs 8 of them. papic_guest_captures recorded media_type and duration_ms and
-- never what the capture was charged.
--
-- ⛔ AND THE BANDS ARE NOT DERIVED HERE. The metering RPCs deliberately never
-- know the clip cost (20270903248590: "the metering RPCs never hardcode a clip
-- cost"); it arrives from TypeScript, from the ONE place that writes it
-- (lib/papic-cameras.ts · PAPIC_POINTS_PER_CLIP). A CASE statement in this file
-- would be a second copy of a money rule, and two copies of a money rule always
-- drift. So the cost is PASSED IN and STORED, once, at write time — which also
-- makes an unknown-length clip cost what it was actually charged rather than
-- what a later re-derivation would guess.
--
-- DEFAULT 1: every historical row is a photo-cost row, and the 2-argument caller
-- (which cannot pass a cost) charges the minimum rather than nothing.
ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS points_cost INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.papic_guest_captures'::regclass
       AND conname  = 'papic_guest_captures_points_cost_positive'
  ) THEN
    ALTER TABLE public.papic_guest_captures
      ADD CONSTRAINT papic_guest_captures_points_cost_positive
      CHECK (points_cost >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.papic_guest_captures.points_cost IS
  'What this capture was charged, in credits, recorded at write time by '
  'papic_record_guest_capture from the cost its caller already computed (1 photo '
  '· 8 for a ten-second clip — lib/papic-cameras.ts owns both weights and this '
  'column never re-derives them). Summing it is how a guest''s spend is measured '
  'against their ceiling. ⚠ The sum does NOT filter hidden_at: hiding a capture '
  'must never reset the meter.';

-- `papic_guest_captures` holds table-level SELECT for authenticated (relacl
-- arwdDxtm, 0 column ACLs — measured 2026-08-27 in 20271140609999), so unlike
-- `events` a new column here is readable without a grant. Written anyway:
-- idempotent, costs nothing, and survives a future table-level REVOKE.
GRANT SELECT (points_cost) ON public.papic_guest_captures TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · HOW MANY GUESTS THERE ARE — extracted, so it is said once
-- ═══════════════════════════════════════════════════════════════════════════
-- The equal share divides by a headcount, and a headcount was already computed
-- inside papic_event_pool_status. Copying that expression into the resolver
-- would be the second copy of a rule — the disease this whole build exists to
-- cure — so it comes OUT of pool_status and both callers ask the same function.
--
-- 🪤 AND pool_status'S OWN `guest_count` COULD NOT HAVE BEEN USED. It is only
-- populated on the flat-pass branch; on a grant-driven event (which is EVERY
-- celebration, because the free 50-credit grant is armed on render) it returns
-- a hard-coded 0. Dividing by it would have made every derived share a
-- division by zero. Measured against production before this was written.
CREATE OR REPLACE FUNCTION public.papic_event_guest_headcount(
  p_event_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
           COALESCE(e.final_pax, 0),
           COALESCE(e.estimated_pax, 0),
           COALESCE((
             SELECT COUNT(*) FROM public.guests g
              WHERE g.event_id = p_event_id
                AND g.deleted_at IS NULL
                AND g.rsvp_status::text <> 'declined'
           ), 0)
         )::INTEGER
    FROM public.events e
   WHERE e.event_id = p_event_id;
$$;

COMMENT ON FUNCTION public.papic_event_guest_headcount(UUID) IS
  'How many guests this celebration is sized for: the largest of the final '
  'headcount, the estimate, and the guests actually on the list who have not '
  'declined. Lifted verbatim out of papic_event_pool_status so the pot''s size '
  'and a guest''s equal share divide by the SAME number rather than two copies '
  'of one expression. NULL for an event that does not exist.';

REVOKE ALL ON FUNCTION public.papic_event_guest_headcount(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_event_guest_headcount(UUID) TO service_role;

-- Replaces the body from 20271131476413. ONE change: the headcount expression
-- becomes a call. Everything else — the shared-grant read, the applies test, the
-- allocation subtraction, the arithmetic and the returned tuple — is verbatim.
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

  v_total := v_base + COALESCE(v_granted, 0) - COALESCE(v_alloc, 0);

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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · THE ONE RESOLVER — what may THIS guest spend?
-- ═══════════════════════════════════════════════════════════════════════════
-- NULL means "no ceiling binds on this guest right now". Every reader — the
-- capture gate today, the guest's counter when S4 lands, the couple's summary
-- line when S3 lands — asks THIS function. § 1's live defect was one rule with
-- two readers that drifted; this build gets one rule with one reader.
--
-- 🔴 DERIVED AT SPEND TIME, NEVER STAMPED ON A GUEST. Both inputs move: the
-- couple tops the pot up and guests keep accepting, so a stamped share is stale
-- the moment either changes and would need a re-stamp sweep on every top-up and
-- every RSVP.
--
-- The three tiers, in the order they are asked:
--   1 · a guest the couple NAMED   → her figure, all night, release-proof (7c)
--   2 · everybody else             → the couple's number, or an equal share
--   3 · the excess                 → nobody's ceiling; first come, first served
CREATE OR REPLACE FUNCTION public.papic_guest_spend_ceiling(
  p_guest_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_on         BOOLEAN;
  v_everyone   INTEGER;
  v_released   TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_event_date DATE;
  v_tz         TEXT;
  v_named      INTEGER;
  v_auto_at    TIMESTAMPTZ;
  v_applies    BOOLEAN;
  v_total      INTEGER;
  v_named_sum  INTEGER;
  v_named_cnt  INTEGER;
  v_heads      INTEGER;
BEGIN
  IF p_guest_id IS NULL THEN RETURN NULL; END IF;

  SELECT g.event_id INTO v_event_id
    FROM public.guests g
   WHERE g.guest_id = p_guest_id
     AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN RETURN NULL; END IF;

  SELECT e.papic_guest_spend_ceiling_on,
         e.papic_guest_spend_ceiling_points,
         e.papic_guest_spend_ceiling_released_at,
         e.papic_window_end,
         e.event_date,
         e.timezone
    INTO v_on, v_everyone, v_released, v_window_end, v_event_date, v_tz
    FROM public.events e
   WHERE e.event_id = v_event_id;

  -- 🔑 THE SWITCH IS THE FIRST WORD, AND THAT IS DELIBERATE. Off — the default,
  -- and every celebration in existence on the day this applied — returns before
  -- a single further read, so this function costs one indexed lookup and the
  -- capture path is what it was.
  IF NOT COALESCE(v_on, FALSE) THEN
    RETURN NULL;
  END IF;

  -- ── TIER 1 · a guest the couple named ────────────────────────────────────
  -- Asked FIRST, and before the release, because naming somebody has to mean
  -- something: her credits wait for her all night whatever else opens up
  -- (owner 7c). 0 is a legitimate figure and means she may not spend.
  SELECT c.ceiling_points INTO v_named
    FROM public.papic_guest_spend_ceilings c
   WHERE c.guest_id = p_guest_id;
  IF v_named IS NOT NULL THEN
    RETURN v_named;
  END IF;

  -- ── THE RELEASE (owner 7a) · the couple's button ─────────────────────────
  -- "Open the rest to everyone." Lifts tiers 2 and 3 and nothing else.
  IF v_released IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- ── THE RELEASE · and it also happens by itself, late ─────────────────────
  -- So nobody is ever locked out of a pot that still holds credits because the
  -- couple were busy getting married. Derived, never scheduled: a cron that
  -- fails to run is a promise that fails silently, and this cannot fail to run
  -- because it is computed at the moment the question is asked.
  --
  -- ⚠ BEING LATE IS HARMLESS; BEING EARLY BREAKS THE PROMISE. So the fallback
  -- for a celebration with no window is the END of the event day rather than
  -- any guess at when the party thins out. The authoritative capture window
  -- lives in lib/papic-window.ts and this does not attempt to reproduce it —
  -- it only needs a moment that is certainly near the end.
  v_auto_at := COALESCE(
    v_window_end,
    CASE WHEN v_event_date IS NOT NULL
      THEN ((v_event_date + 1)::timestamp AT TIME ZONE COALESCE(v_tz, 'Asia/Manila'))
    END
  ) - INTERVAL '2 hours';
  IF v_auto_at IS NOT NULL AND NOW() >= v_auto_at THEN
    RETURN NULL;
  END IF;

  -- ── TIER 2 · the number the couple typed for everyone else ────────────────
  IF v_everyone IS NOT NULL THEN
    RETURN v_everyone;
  END IF;

  -- ── TIER 2 · derived — an equal share of what the named guests left ───────
  SELECT applies, total_points
    INTO v_applies, v_total
    FROM public.papic_event_pool_status(v_event_id);

  -- No pot at all: there is nothing to divide and the ownership gate refuses
  -- this capture anyway. A ceiling here would be arithmetic about nothing.
  IF NOT COALESCE(v_applies, FALSE) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(ceiling_points), 0)::INTEGER, COUNT(*)::INTEGER
    INTO v_named_sum, v_named_cnt
    FROM public.papic_guest_spend_ceilings
   WHERE event_id = v_event_id;

  v_heads := COALESCE(public.papic_event_guest_headcount(v_event_id), 0) - v_named_cnt;

  -- Everybody is named, or the headcount has not caught up with the naming.
  -- There is no "everyone else" to divide among, so tier 2 does not exist.
  IF v_heads <= 0 THEN
    RETURN NULL;
  END IF;

  -- ⚖ THE FLOOR OF ONE, AND WHY IT IS NOT A FUDGE. A 200-guest celebration
  -- holding only the free 50-credit grant divides to a share of zero, and a
  -- ceiling of zero would refuse every guest their FIRST photograph — with a
  -- refusal that reads "you have spent your allowance" when they have spent
  -- nothing. The pot is the money gate and it is untouched; this is a FAIRNESS
  -- rule between guests, and a fairness rule must never be the thing that
  -- stops the party. It never opens more credits than the pot holds, because
  -- the pot refuses on its own.
  RETURN GREATEST(1, FLOOR(GREATEST(v_total - v_named_sum, 0)::NUMERIC / v_heads)::INTEGER);
END;
$$;

COMMENT ON FUNCTION public.papic_guest_spend_ceiling(UUID) IS
  'How many CREDITS this guest may still be allowed to spend in total — the ONE '
  'place the three tiers are resolved. NULL means no ceiling binds (the switch '
  'is off, the couple released the rest, the celebration is in its last stretch, '
  'or there is no pot to divide). Derived at spend time and never stamped on a '
  'guest: the pot grows with top-ups and the headcount grows with RSVPs, so a '
  'stored share is stale the moment either moves.';

REVOKE ALL ON FUNCTION public.papic_guest_spend_ceiling(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_guest_spend_ceiling(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · THE TWO WRITES — the couple names a guest, and opens the rest
-- ═══════════════════════════════════════════════════════════════════════════
-- These are the contract the control centre (S3) calls. Both take a TARGET
-- rather than a delta, so giving and taking back are the same call, a
-- double-submit is harmless, and there is no second function anybody could
-- forget to write. That rule is not new here — papic_dedicate_shots states it
-- in its own header, and it exists because this codebase once shipped a forward
-- primitive whose inverse was simply missing.

CREATE OR REPLACE FUNCTION public.papic_set_guest_spend_ceiling(
  p_event_id UUID,
  p_guest_id UUID,
  p_points   INTEGER,
  p_actor    UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_event UUID;
BEGIN
  IF p_event_id IS NULL OR p_guest_id IS NULL THEN
    RAISE EXCEPTION 'papic_set_guest_spend_ceiling: bad arguments'
      USING ERRCODE = '22023';
  END IF;
  IF p_points IS NOT NULL AND p_points < 0 THEN
    RAISE EXCEPTION 'papic_set_guest_spend_ceiling: a ceiling cannot be negative'
      USING ERRCODE = '22023';
  END IF;

  -- CROSS-EVENT GUARD. A guest id is not a capability: without this one
  -- celebration's couple could name another celebration's guest. Same guard
  -- papic_dedicate_shots carries, for the same reason.
  SELECT g.event_id INTO v_guest_event
    FROM public.guests g
   WHERE g.guest_id = p_guest_id
     AND g.deleted_at IS NULL;
  IF v_guest_event IS NULL OR v_guest_event <> p_event_id THEN
    RAISE EXCEPTION 'papic_set_guest_spend_ceiling: that guest is not on this celebration'
      USING ERRCODE = '42501';
  END IF;

  -- NULL is the inverse: the guest stops being named and falls back to the
  -- equal share like everyone else. Nothing is stranded — this is the same call
  -- in the other direction, which is why there is no second function.
  IF p_points IS NULL THEN
    DELETE FROM public.papic_guest_spend_ceilings WHERE guest_id = p_guest_id;
    RETURN NULL;
  END IF;

  INSERT INTO public.papic_guest_spend_ceilings (guest_id, event_id, ceiling_points, updated_by)
  VALUES (p_guest_id, p_event_id, p_points, p_actor)
  ON CONFLICT (guest_id) DO UPDATE
    SET ceiling_points = EXCLUDED.ceiling_points,
        updated_at     = NOW(),
        updated_by     = EXCLUDED.updated_by;

  RETURN p_points;
END;
$$;

COMMENT ON FUNCTION public.papic_set_guest_spend_ceiling(UUID, UUID, INTEGER, UUID) IS
  'Name a guest and give her a credit ceiling of her own — or pass NULL to '
  'un-name her and put her back on the equal share. TARGET, not delta: setting '
  'the same figure twice is that figure, and the inverse is this same call, so '
  'nothing can be stranded. ⚠ Nothing is MOVED out of the shared pot — this is a '
  'ceiling. Contrast papic_dedicate_shots, which is a floor and does move '
  'credits.';

REVOKE ALL ON FUNCTION public.papic_set_guest_spend_ceiling(UUID, UUID, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_set_guest_spend_ceiling(UUID, UUID, INTEGER, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.papic_set_guest_spend_ceiling_release(
  p_event_id UUID,
  p_released BOOLEAN DEFAULT TRUE,
  p_actor    UUID DEFAULT NULL
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at TIMESTAMPTZ;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'papic_set_guest_spend_ceiling_release: bad arguments'
      USING ERRCODE = '22023';
  END IF;

  SELECT papic_guest_spend_ceiling_released_at INTO v_at
    FROM public.events WHERE event_id = p_event_id FOR UPDATE;

  IF COALESCE(p_released, TRUE) THEN
    -- Already open stays open at the moment it was FIRST opened. Re-pressing a
    -- button must not quietly move a timestamp somebody may later be reading as
    -- "when did the room open up".
    IF v_at IS NOT NULL THEN RETURN v_at; END IF;
    v_at := NOW();
  ELSE
    -- The inverse, in the same call. Closing again does not un-spend anything
    -- somebody already took while it was open — nothing could.
    v_at := NULL;
  END IF;

  UPDATE public.events
     SET papic_guest_spend_ceiling_released_at = v_at
   WHERE event_id = p_event_id;

  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.papic_set_guest_spend_ceiling_release(UUID, BOOLEAN, UUID) IS
  '"Open the rest to everyone" (owner 7a), and its inverse in the same call. '
  'Lifts tiers 2 and 3 — the equal share and the excess — for the rest of the '
  'celebration. ⛔ It NEVER lifts a NAMED guest''s ceiling: hers are hers all '
  'night (owner 7c). The same release also happens by itself in the last stretch '
  'of the celebration; this is the couple''s early call, not the only one.';

REVOKE ALL ON FUNCTION public.papic_set_guest_spend_ceiling_release(UUID, BOOLEAN, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_set_guest_spend_ceiling_release(UUID, BOOLEAN, UUID)
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · THE GATE — inside papic_record_guest_capture, and nowhere else
-- ═══════════════════════════════════════════════════════════════════════════
-- That function is the ONE object an anonymous direct caller still reaches:
-- 20271114597183 deliberately keeps its EXECUTE for anon + authenticated —
-- "That is the anonymous guest-capture path and must keep working." Guests hold
-- no table grant on papic_guest_captures; every insert goes through this
-- SECURITY DEFINER writer.
--
-- ⇒ A ceiling written in the route, in the reserve helper, or in a new advisory
-- RPC is bypassable by exactly that caller. Only what is inside this binds.
--
-- ── 🚨 WHY THE OLD SIGNATURES ARE DROPPED RATHER THAN LEFT ALONE ───────────
-- The rule from the spec is "CREATE OR REPLACE the newest body, do NOT add a
-- fourth overload". Storing what a capture cost needs the cost passed in, and
-- in PostgreSQL a new parameter — even a defaulted one — is a NEW FUNCTION, not
-- a replacement.
--
-- 🪤 MEASURED IN PRODUCTION, NOT REASONED (2026-08-30, in a rolled-back
-- transaction against setnayan-prod): with a 3-argument and a 4-argument
-- overload both present and all arguments defaulted, a 3-argument named call
-- fails `42725 function ... is not unique`. Two consequences, both bad:
--   • every live guest capture would have failed at once; and
--   • the route's signature-fallback ladder matches on the regex
--     /function .*papic_record_guest_capture/, which MATCHES that very error —
--     so it would have quietly retried the 2-argument shape and recorded every
--     clip as a photo with no duration and no poster. Silent data loss.
-- The same probe with the 3-argument overload dropped resolved cleanly to the
-- 4-argument one. So: drop, then create. An old deploy still calling with six
-- named arguments lands on this function with p_points_cost defaulted, which is
-- exactly the rollout behaviour we want.
--
-- ⚖ THE 2-ARGUMENT OVERLOAD GOES TOO, AND THAT IS A NARROWING. It has been
-- UNREACHABLE for as long as the 6-argument one existed — any 2-argument call
-- matched both and raised 42725 — so nothing can be relying on it, and leaving
-- it would leave a second anon-callable door into this table that would need
-- its own copy of this gate. One function, one gate.
DROP FUNCTION IF EXISTS public.papic_record_guest_capture(UUID, TEXT);
DROP FUNCTION IF EXISTS public.papic_record_guest_capture(UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT);

CREATE FUNCTION public.papic_record_guest_capture(
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
  v_ceiling := public.papic_guest_spend_ceiling(p_guest_id);

  -- The event pool is the authoritative ceiling for a pool-driven event, so the
  -- per-guest 150 must NOT double-cap it: yield the per-guest gate whenever the
  -- pool applies.
  --
  -- 🔑 THE YIELD BECOMES CONDITIONAL. The pot caps the celebration; the couple's
  -- ceiling caps ONE GUEST INSIDE IT, and the tightest gate has to win — a pot
  -- that stood the per-guest gate down unconditionally would make every ceiling
  -- inert on every event, which is precisely the defect this build was written
  -- to fix. With no ceiling set this line is what it was.
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
  SELECT COALESCE(SUM(points_cost), 0)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  -- ── THE COUPLE'S CEILING BINDS FIRST ─────────────────────────────────────
  -- Asked before the platform's own 150 and independently of `v_unlimited`: a
  -- PAPIC_UNLOCK pass says the COUPLE bought their way past OUR limit, which is
  -- not permission to walk through the limit the couple themselves set on one
  -- guest.
  IF v_ceiling IS NOT NULL AND (v_used + v_cost) > v_ceiling THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      -- The status stays what the route and the offline drain already handle
      -- (both release the booking and neither treats it as terminal). `reason`
      -- is what lets the guest's screen tell "your own allowance is spent" apart
      -- from "the celebration's credits are spent" — two refusals that must
      -- never inherit each other's copy.
      'reason', 'guest_spend_ceiling',
      'total', v_ceiling,
      'used', v_used,
      'remaining', GREATEST(0, v_ceiling - v_used)
    );
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

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', COALESCE(v_ceiling, v_credits),
    'used', v_used + v_cost,
    -- Unlimited guests report a non-zero remaining so no numeric consumer ever
    -- reads "exhausted"; the client shows "Unlimited" off the server-rendered
    -- flag regardless. A guest under a ceiling is never one of them.
    'remaining', CASE
      WHEN v_ceiling IS NOT NULL THEN GREATEST(0, v_ceiling - (v_used + v_cost))
      WHEN v_unlimited THEN v_credits
      ELSE GREATEST(0, v_credits - (v_used + v_cost))
    END,
    'unlimited', (v_unlimited AND v_ceiling IS NULL),
    'ceiling', v_ceiling
  );
END;
$$;

-- The surface is reproduced exactly as it stood before the drop: anon and
-- authenticated keep EXECUTE because this IS the anonymous guest-capture path
-- (20271114597183 says so in as many words). Written explicitly rather than
-- left to the default PUBLIC grant, so the intent is legible.
REVOKE ALL ON FUNCTION public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8 · ASSERTIONS — this migration refuses to apply if it did not do its job
-- ═══════════════════════════════════════════════════════════════════════════
-- Every one of these is a thing that has gone wrong on this surface before. A
-- comment saying "remember the grant" is a sentence; this is a mechanism.
DO $$
DECLARE
  v_rls        BOOLEAN;
  v_overloads  INTEGER;
  v_def        TEXT;
  v_col        TEXT;
BEGIN
  -- The new table ships closed. Public tables ship OPEN by default in this
  -- schema, so both halves are checked, not just RLS.
  SELECT relrowsecurity INTO v_rls
    FROM pg_class WHERE oid = 'public.papic_guest_spend_ceilings'::regclass;
  IF NOT COALESCE(v_rls, FALSE) THEN
    RAISE EXCEPTION 'papic_guest_spend_ceilings shipped without RLS';
  END IF;
  IF has_table_privilege('anon', 'public.papic_guest_spend_ceilings', 'SELECT')
     OR has_table_privilege('authenticated', 'public.papic_guest_spend_ceilings', 'SELECT') THEN
    RAISE EXCEPTION
      'papic_guest_spend_ceilings is readable by a session role — new public tables ship OPEN, the REVOKE was missed';
  END IF;

  -- ONE writer, ONE gate. More than one overload is the ambiguity that would
  -- have made every capture fail and then silently degrade every clip.
  SELECT COUNT(*) INTO v_overloads
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_record_guest_capture';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION
      'papic_record_guest_capture has % overloads — a named call resolves to none of them (42725) and the route''s fallback ladder degrades every clip to a photo',
      v_overloads;
  END IF;

  -- The gate is IN the writer. A ceiling resolved anywhere else is bypassable
  -- by the anonymous direct caller this function exists to stand in front of.
  v_def := pg_get_functiondef(
    'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer)'::regprocedure);
  IF v_def NOT LIKE '%papic_guest_spend_ceiling%' THEN
    RAISE EXCEPTION 'papic_record_guest_capture does not consult papic_guest_spend_ceiling — the ceiling would govern nothing';
  END IF;
  IF v_def NOT LIKE '%SUM(points_cost)%' THEN
    RAISE EXCEPTION 'papic_record_guest_capture still meters in rows rather than credits';
  END IF;

  -- The anonymous guest-capture path must keep working — the drop and re-create
  -- above is exactly where that grant could have been lost.
  IF NOT has_function_privilege('anon',
       'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon lost EXECUTE on papic_record_guest_capture — every guest camera would stop';
  END IF;

  -- The headcount is said once, and the pot is the caller that proves it.
  IF (SELECT pg_get_functiondef('public.papic_event_pool_status(uuid)'::regprocedure))
     NOT LIKE '%papic_event_guest_headcount%' THEN
    RAISE EXCEPTION 'papic_event_pool_status does not call papic_event_guest_headcount — the headcount is written twice again';
  END IF;

  -- 🚨 THE GRANT TRAP. An ungranted column on `events` makes PostgREST refuse
  -- the WHOLE query, so every user-session read of events goes silently empty.
  FOREACH v_col IN ARRAY ARRAY[
    'papic_guest_spend_ceiling_on',
    'papic_guest_spend_ceiling_points',
    'papic_guest_spend_ceiling_released_at'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', v_col, 'SELECT') THEN
      RAISE EXCEPTION 'events.% has no SELECT grant — every signed-in read of events would go empty', v_col;
    END IF;
    IF NOT has_column_privilege('authenticated', 'public.events', v_col, 'UPDATE') THEN
      RAISE EXCEPTION 'events.% has no UPDATE grant — the couple could not save the setting', v_col;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = v_col
    ) THEN
      RAISE EXCEPTION 'events_host is missing % — a phantom column on the host view kills Personalization', v_col;
    END IF;
  END LOOP;

  -- INERT ON ARRIVAL. If this is ever untrue at apply time, something set a
  -- ceiling before there was a control to set one with.
  IF EXISTS (SELECT 1 FROM public.events WHERE papic_guest_spend_ceiling_on) THEN
    RAISE EXCEPTION 'a celebration already has a guest spending ceiling switched on — this migration expected to be inert on arrival';
  END IF;
END $$;

COMMIT;
