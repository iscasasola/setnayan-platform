-- ============================================================================
-- 20261021000000_guest_invite_claim.sql
-- Privacy-first guest invite-CLAIM + double-verification (in-scope delta of the
-- "Reverse Contact-Drop" design, owner-authorized 2026-06-10). Hardened
-- 2026-06-10 after a 6-dimension adversarial review (14 confirmed findings).
--
-- WHY: today /join/[eventId] auto-admits ANY signed-in user whose email does
-- not exactly match a guests (seed-list) row — it silently mints a placeholder
-- guests row + event_members link. Worse, the base member_can_self_join policy
-- lets any authenticated user self-insert as member_type='couple'. This closes
-- both, WITHOUT the locked-against pieces (no SMS, no NextAuth, no Prisma, no
-- rolling QR):
--
--   * exact-email match  → linked directly (highest confidence)
--   * single fuzzy match w/ a seed email → EMAIL-OTP handshake (Resend) proves
--     the claimer controls the address the couple recorded for that person
--   * single fuzzy match, no seed email → couple review (no auto-admit)
--   * same-name collision (2+ matches) → couple review (anti-hijack)
--   * no match (uninvited)             → couple review ("silent waitlist")
--
-- The guests table IS the "Seed List" (iteration 0001) — no new seed table.
--
-- RLS: claimers NEVER touch guest_claims with their own JWT — the whole claim
-- lifecycle runs through server actions on the service-role admin client, each
-- scoped by claimer_user_id. So guest_claims has NO claimer policy (deny by
-- default); only couples (event-scoped) + admins can read/update. The OTP is
-- HMAC'd with a server-only key (lib/guest-claim.ts) so even a row read can't
-- brute-force a 6-digit code; the attempt cap is enforced atomically in
-- register_guest_claim_otp_attempt() so concurrent guesses can't each get a
-- fresh try.
-- ============================================================================

-- New enum values used only at RUNTIME (by app code / function bodies), never
-- in this migration's own transaction, so PG's "can't use a new enum value in
-- the same tx" rule is never tripped. Done OUTSIDE the BEGIN below.
ALTER TYPE public.join_method ADD VALUE IF NOT EXISTS 'invite_claim';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'guest_claim_pending';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Claim status enum
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.guest_claim_status AS ENUM (
    'pending_review',  -- waiting on couple approval (no/ambiguous match, or no seed email)
    'otp_sent',        -- email code dispatched to the matched seed row's address
    'confirmed',       -- verified + linked to a guests row + event_members
    'rejected'         -- couple denied, or superseded
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. guest_claims  (internal operational ledger — no public_id surface, same as
--    households: it isn't a user-addressable entity)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guest_claims (
  id                  BIGSERIAL PRIMARY KEY,
  claim_id            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  claimer_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimer_name        TEXT NOT NULL,                       -- name presented (for couple review)
  claimer_email       TEXT,                                -- the authed user's login email
  requested_role      public.guest_role NOT NULL DEFAULT 'guest',
  -- Matched seed-list row (NULL when there is no confident single match).
  target_guest_id     UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  match_score         NUMERIC(4,3),                        -- 0..1 fuzzy score of target match
  status              public.guest_claim_status NOT NULL DEFAULT 'pending_review',
  -- Email-OTP handshake (only populated when target seed row HAS an email).
  otp_code_hmac       TEXT,                                -- HMAC-SHA256(code, server secret); never the raw code
  otp_sent_to         TEXT,                                -- destination address (couple-recorded seed email)
  otp_expires_at      TIMESTAMPTZ,
  otp_attempts        INT NOT NULL DEFAULT 0,
  otp_last_sent_at    TIMESTAMPTZ,
  -- Claim-creation throttle (anti-enumeration / anti-email-bomb / anti-DoS).
  claim_attempts      INT NOT NULL DEFAULT 0,
  last_claim_at       TIMESTAMPTZ,
  -- Resolution.
  resolved_guest_id   UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One open claim per user per event (server actions upsert on retry).
  UNIQUE (event_id, claimer_user_id)
);

CREATE INDEX IF NOT EXISTS guest_claims_event_status_idx
  ON public.guest_claims(event_id, status);
CREATE INDEX IF NOT EXISTS guest_claims_target_idx
  ON public.guest_claims(target_guest_id) WHERE target_guest_id IS NOT NULL;

ALTER TABLE public.guest_claims ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. RLS — couple-read/write + admin ONLY (claimers go through the admin client
--    server-side, so they get no policy here = deny by default for their JWT).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS couple_reads_guest_claims ON public.guest_claims;
CREATE POLICY couple_reads_guest_claims ON public.guest_claims
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_writes_guest_claims ON public.guest_claims;
CREATE POLICY couple_writes_guest_claims ON public.guest_claims
  FOR UPDATE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 4. Tighten member_can_self_join (SECURITY — review finding #1, pre-existing).
--    The base policy's self-branch (user_id = auth.uid()) constrained NOTHING
--    about member_type/role/guest_id, so any authenticated user could
--    self-insert as member_type='couple' (full event takeover) or bind an
--    arbitrary guest_id — exactly the universal-join-link threat this feature
--    closes. The ONLY user-scoped event_members insert in the app is the /join
--    exact-email path (moved to the admin client in this PR); couple creation
--    already uses the admin client. So the self-branch is narrowed to a plain,
--    unprivileged guest self-join.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS member_can_self_join ON public.event_members;
CREATE POLICY member_can_self_join ON public.event_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND member_type = 'guest'
      AND guest_id IS NULL
      AND vendor_id IS NULL
    )
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 5. Hardening index — one event_members link per (event, guest) row, so two
--    racing claimers can NEVER both bind the same seed person. This is the HARD
--    anti-double-bind backstop, so it must NEVER be silently absent: detach any
--    legacy duplicate bindings FIRST (non-destructively — NULL the guest_id on
--    the later duplicate, keeping the membership row), then create the index
--    UNCONDITIONALLY. (The pre-reset auto-admit model could mint duplicate
--    (event_id, guest_id) rows, so a clean-data assumption was unsafe.)
-- ----------------------------------------------------------------------------

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY event_id, guest_id ORDER BY joined_at, id
         ) AS rn
  FROM public.event_members
  WHERE guest_id IS NOT NULL
)
UPDATE public.event_members em
SET guest_id = NULL
FROM ranked r
WHERE em.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS event_members_event_guest_uniq
  ON public.event_members(event_id, guest_id)
  WHERE guest_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. finalize_guest_claim — atomically bind a verified/approved claim to a
--    guests row + an event_members link, idempotently. SECURITY DEFINER,
--    service_role only. Returns JSONB { linked, guest_id, already, reason }.
--
--    Guards (one tx):
--      1.  claim exists + not already confirmed
--      1b. seed row belongs to THIS claim's event (privileged-choke self-check)
--      2.  per-(event,guest) advisory lock SERIALIZES concurrent finalizers
--          (the FOR UPDATE on guest_claims does NOT — two racers hold different
--          claim rows), then re-check the seed row isn't bound to another user
--      3.  the unique index is the hard backstop; the INSERT is wrapped so a
--          true race surfaces as a clean 'guest_already_claimed' return, not a
--          raw unique_violation
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finalize_guest_claim(
  p_claim_id  UUID,
  p_guest_id  UUID,          -- the seed row to bind (may be a couple-chosen row on approval)
  p_reviewer  UUID DEFAULT NULL  -- couple/admin user id when approved via review; NULL on OTP self-verify
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_user_id    UUID;
  v_role       public.guest_role;
  v_status     public.guest_claim_status;
  v_owner_user UUID;
BEGIN
  SELECT event_id, claimer_user_id, requested_role, status
    INTO v_event_id, v_user_id, v_role, v_status
  FROM public.guest_claims
  WHERE claim_id = p_claim_id
  FOR UPDATE;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'claim_not_found');
  END IF;
  IF v_status = 'confirmed' THEN
    RETURN jsonb_build_object('linked', true, 'already', true,
                              'guest_id', p_guest_id, 'reason', 'already_confirmed');
  END IF;

  -- Guard 1b: the seed row must belong to THIS claim's event.
  PERFORM 1 FROM public.guests WHERE guest_id = p_guest_id AND event_id = v_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'guest_event_mismatch');
  END IF;

  -- Serialize concurrent finalizers for the SAME (event, seed guest).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_event_id::text || ':' || p_guest_id::text, 0));

  -- Guard 2: is this seed row already claimed by a different user?
  SELECT user_id INTO v_owner_user
  FROM public.event_members
  WHERE event_id = v_event_id AND guest_id = p_guest_id
  LIMIT 1;

  IF v_owner_user IS NOT NULL AND v_owner_user <> v_user_id THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'guest_already_claimed');
  END IF;

  -- Bind the claimer to this seed row (idempotent on the user's single membership).
  BEGIN
    INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
    VALUES (v_event_id, v_user_id, 'guest', v_role::text, 'invite_claim', p_guest_id)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET guest_id = EXCLUDED.guest_id, role = EXCLUDED.role;
  EXCEPTION WHEN unique_violation THEN
    -- event_members_event_guest_uniq fired → another user won the race.
    RETURN jsonb_build_object('linked', false, 'reason', 'guest_already_claimed');
  END;

  -- Stamp the claim as resolved.
  UPDATE public.guest_claims
  SET status = 'confirmed',
      resolved_guest_id = p_guest_id,
      reviewed_by_user_id = COALESCE(p_reviewer, reviewed_by_user_id),
      reviewed_at = CASE WHEN p_reviewer IS NOT NULL THEN NOW() ELSE reviewed_at END,
      otp_code_hmac = NULL,           -- burn the code on success
      updated_at = NOW()
  WHERE claim_id = p_claim_id;

  RETURN jsonb_build_object('linked', true, 'already', false, 'guest_id', p_guest_id);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_guest_claim(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_guest_claim(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_guest_claim(UUID, UUID, UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 7. register_guest_claim_otp_attempt — ATOMIC increment-and-check of the OTP
--    attempt budget. The WHERE clause enforces status + expiry + the 5-try cap
--    in ONE statement, so N concurrent verify requests can't each slip a fresh
--    guess through a read-modify-write window. Returns the hmac+target only when
--    a try is still allowed. SECURITY DEFINER, service_role only.
--    NOTE: the literal 5 mirrors OTP_MAX_ATTEMPTS in lib/guest-claim.ts.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_guest_claim_otp_attempt(
  p_claim_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hmac     TEXT;
  v_target   UUID;
  v_attempts INT;
BEGIN
  UPDATE public.guest_claims
  SET otp_attempts = otp_attempts + 1, updated_at = NOW()
  WHERE claim_id = p_claim_id
    AND status = 'otp_sent'
    AND otp_attempts < 5
    AND otp_expires_at > NOW()
  RETURNING otp_code_hmac, target_guest_id, otp_attempts
  INTO v_hmac, v_target, v_attempts;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'hmac', v_hmac,
                            'target_guest_id', v_target, 'attempts', v_attempts);
END;
$$;

REVOKE ALL ON FUNCTION public.register_guest_claim_otp_attempt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_guest_claim_otp_attempt(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.register_guest_claim_otp_attempt(UUID) TO service_role;

COMMENT ON TABLE public.guest_claims IS
  'Privacy-first guest invite-claim ledger (20261021). Claimers interact only via '
  'service-role server actions; couples review pending_review rows from the '
  'guest-list dashboard. OTP is HMAC-stored + atomically rate-limited.';

COMMIT;
