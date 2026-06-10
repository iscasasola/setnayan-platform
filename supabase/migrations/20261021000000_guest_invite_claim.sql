-- ============================================================================
-- 20261021000000_guest_invite_claim.sql
-- Privacy-first guest invite-CLAIM + double-verification (in-scope delta of the
-- "Reverse Contact-Drop" design, owner-authorized 2026-06-10).
--
-- WHY: today /join/[eventId] auto-admits ANY signed-in user whose email does
-- not exactly match a guests (seed-list) row — it silently mints a placeholder
-- guests row + event_members link. That's the loophole the owner's design
-- worried about (a stranger with the universal link self-admits). This adds the
-- couple-curated safety the live model promises WITHOUT the locked-against
-- pieces (no SMS, no NextAuth, no Prisma, no rolling QR):
--
--   * exact-email match  → linked directly (unchanged; highest confidence)
--   * single fuzzy match w/ a seed email → EMAIL-OTP handshake (Resend) proves
--     the claimer controls the address the couple recorded for that person
--   * single fuzzy match, no seed email → couple review (no auto-admit)
--   * same-name collision (2+ matches) → couple review (anti-hijack, design #4)
--   * no match (uninvited)             → couple review ("silent waitlist", #3)
--
-- The guests table IS the "Seed List" (iteration 0001) — no new seed table.
-- This migration only adds the CLAIM ledger + a finalize RPC + a hardening
-- index. Couples review pending claims from the guest-list dashboard.
--
-- RLS: claimers NEVER touch guest_claims with their own JWT — the whole claim
-- lifecycle runs through server actions on the service-role admin client, each
-- scoped by claimer_user_id = the authed user. So guest_claims has NO claimer
-- SELECT/INSERT policy (deny by default); only couples (event-scoped) + admins
-- can read/update, for the review surface. The OTP secret is ALSO HMAC'd with a
-- server-only key (see lib/guest-claim.ts) so even a hypothetical row read can't
-- brute-force a 6-digit code. Belt and suspenders.
-- ============================================================================

-- New join_method for the claim path. Done OUTSIDE the tx below + only USED at
-- runtime by finalize_guest_claim (post-commit), so PG's "can't use a new enum
-- value in the same transaction" rule is never tripped.
ALTER TYPE public.join_method ADD VALUE IF NOT EXISTS 'invite_claim';

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
--    Mirrors the couple_writes_guest / event_member_can_read_guest shape.
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
-- 4. Hardening index — one event_members link per (event, guest) row, so two
--    racing claimers can NEVER both bind the same seed person (design #4, and a
--    guard against the TOCTOU class flagged in the conflict-architecture notes).
--    Created ONLY when existing data is already clean, so this migration never
--    fails on legacy duplicates; if skipped, the finalize RPC still guards in-tx.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members
    WHERE guest_id IS NOT NULL
    GROUP BY event_id, guest_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS event_members_event_guest_uniq
      ON public.event_members(event_id, guest_id)
      WHERE guest_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'event_members has duplicate (event_id, guest_id) rows — skipping unique index; finalize_guest_claim still guards in-tx.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. finalize_guest_claim — atomically bind a verified/approved claim to a
--    guests row + an event_members link, idempotently. SECURITY DEFINER,
--    service_role only: called from the server-side claim/verify/approve flow
--    AFTER the action has validated the OTP (or the couple approved). Returns
--    JSONB { linked, guest_id, already, reason }.
--
--    Guards (all in one tx, so the unique index above makes step 2 race-proof):
--      1. claim must exist + belong to the event + not already confirmed/rejected
--      2. target guests row must not already be linked to ANOTHER user
--      3. claimer must not already be a member (event_members UNIQUE(event,user))
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

  -- Guard 2: is this seed row already claimed by a different user?
  SELECT user_id INTO v_owner_user
  FROM public.event_members
  WHERE event_id = v_event_id AND guest_id = p_guest_id
  LIMIT 1;

  IF v_owner_user IS NOT NULL AND v_owner_user <> v_user_id THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'guest_already_claimed');
  END IF;

  -- Bind the claimer to this seed row (idempotent on the user's single membership).
  INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
  VALUES (v_event_id, v_user_id, 'guest', v_role::text, 'invite_claim', p_guest_id)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET guest_id = EXCLUDED.guest_id, role = EXCLUDED.role;

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

COMMENT ON TABLE public.guest_claims IS
  'Privacy-first guest invite-claim ledger (20261021). Claimers interact only via '
  'service-role server actions; couples review pending_review rows from the '
  'guest-list dashboard. OTP is HMAC-stored (lib/guest-claim.ts).';

COMMIT;
