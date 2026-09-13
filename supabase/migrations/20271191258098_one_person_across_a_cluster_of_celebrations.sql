-- one person across a cluster of celebrations
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- ITEM 7 · "THE YEAR" — PHASE 7b: ONE PERSON, NOT THREE ROWS.
--
-- WHATS_NEXT_Papic_Build_Order_2026-08-29.md § 7b, on top of the 7a linked-
-- cluster primitive (20271189765490): a guest invited to the engagement party,
-- the shower and the wedding of ONE event_cluster should read as one person
-- with three per-celebration guest rows, not three unrelated strangers.
--
-- ── DIAGNOSIS FIRST (this is the part of the ticket that mattered most) ────
-- The person spine already exists: public.people (39 rows in prod, measured
-- 2026-09-02), public.guests.person_id (indexed), and a UNIFIED RESOLVER —
-- public.resolve_or_claim_person() — wired to guests by the
-- set_guest_person BEFORE trigger (20270514555975), which ALREADY runs on
-- every insert/update of email and backfills on that same migration.
--
-- Measured in prod: 36 guests, 0 with an email, 0 with a person_id. The
-- resolver is NOT broken, has NOT lost its caller, and does NOT fail
-- silently — `set_guest_person()` explicitly, deliberately, returns early on
-- a name-only guest (line "IF nullif(trim(NEW.email), '') IS NULL THEN
-- RETURN NEW"), because email is the only signal the ORIGINAL resolver
-- trusted enough to create a person from unattended (its own comment:
-- "name-only guests are NOT auto-seeded (weak signal → they wait for an
-- explicit "is this you?" confirm, a later slice)"). The guest-add UI
-- (guest-name-fields.tsx) never asks for an email at all, so that signal
-- never arrives. Zero linked guests is the CORRECT output of the resolver as
-- designed, not a defect in it.
--
-- THIS FILE IS THAT "LATER SLICE" — deliberately bounded so it does not
-- reopen the risk the original guard was protecting against. A GLOBAL
-- name-only match (two "Maria Santos" rows anywhere in the product) is
-- unsafe and stays refused. A name match SCOPED TO ONE HOST'S OWN CLUSTER —
-- the wedding and the shower the SAME couple deliberately linked together —
-- is a small, bounded, host-controlled blast radius, which is why the
-- matching added below is gated on event_cluster_members and nothing wider.
--
-- ── WHAT THIS FILE DOES ─────────────────────────────────────────────────
--   1. Extends resolve_or_claim_person() with one new trailing DEFAULT
--      parameter (p_allow_name_only) — additive, does not change any
--      existing call site's behaviour (RULE 0: extend, never re-draw).
--   2. Adds resolve_cluster_guest_person(): given a guest's event + name,
--      find a same-name guest in ANOTHER celebration of the SAME cluster; if
--      that guest already has a person, reuse it; if not, mint one (via the
--      now-extended resolver) and link both rows to it. Returns NULL when
--      the event has no cluster, or no match, or the name is blank — an
--      UNCLUSTERED celebration never merges (guarded below).
--   3. Extends set_guest_person() to try the cluster match when the email
--      path returns NULL — same trigger, same call site, one more line.
--   4. Adds a new AFTER INSERT trigger on event_cluster_members: when a
--      celebration JOINS a cluster, its already-existing name-only guests
--      get one pass of the same matching (the guests existed before the
--      cluster did — order must not matter).
--   5. Adds cluster_guest_roster(): the read shape "one row per person,
--      their per-celebration guest rows underneath" (build item 3). It is
--      SECURITY INVOKER — a plain SQL function with no elevated rights — so
--      it inherits the EXISTING guests RLS (event_member_can_read_guest,
--      current_event_ids()) and the EXISTING event_cluster_members RLS
--      (owner-or-couple-only read, from 20271189765490) with no new policy
--      invented. A stranger or a guest gets zero rows from it for exactly
--      the reasons a-year-holds-only-your-own-celebrations.db.test.ts
--      already proves for the membership table itself.
--
-- NO SCREEN, NO SERVER ACTION. 7a's "phase 7a is schema" applies again here:
-- this is the resolver + the read shape it enables, not a rendered page.
--
-- ⛔ NOT TOUCHED, ON PURPOSE: the shot pot stays per-celebration
-- (a-pot-belongs-to-one-celebration.db.test.ts, re-run unmodified below in
-- the new guard file); nothing here stamps a per-guest share; nothing here
-- is 7c (dates/timeline) or 7d (budgets).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend the unified resolver with an explicit opt-in for name-only
--    creation. Every existing caller (self-claim, sign-up matching, the
--    email-keyed guest trigger, the email backfill) omits the new parameter
--    and keeps its exact original behaviour — refuse a name-only, unclaimed
--    person. Only the new cluster matcher below passes TRUE, and only after
--    it has already confirmed a same-cluster, same-name sibling exists.
-- ---------------------------------------------------------------------------
-- 🪤 CREATE OR REPLACE cannot change a function's parameter LIST — it only
-- replaces a function whose signature matches exactly. Adding a 10th
-- parameter without dropping the 9-parameter original does not replace it;
-- it creates a SECOND, overloaded function. Every existing named-argument
-- caller that omits an optional parameter (e.g. skips p_first_name/
-- p_last_name) then becomes ambiguous between the two overloads and every
-- call raises "is not unique" (42725) — this is not hypothetical, it broke
-- every other test file that calls this resolver until the DROP below was
-- added. The explicit DROP is what makes this an edit, not an overload.
DROP FUNCTION IF EXISTS public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID);

CREATE OR REPLACE FUNCTION public.resolve_or_claim_person(
  p_email            TEXT,
  p_display_name     TEXT DEFAULT NULL,
  p_first_name       TEXT DEFAULT NULL,
  p_last_name        TEXT DEFAULT NULL,
  p_phone            TEXT DEFAULT NULL,
  p_photo_url        TEXT DEFAULT NULL,
  p_birth_date       DATE DEFAULT NULL,
  p_claimer          UUID DEFAULT NULL,
  p_creator          UUID DEFAULT NULL,
  p_allow_name_only  BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT := lower(nullif(trim(p_email), ''));
  v_id      UUID;
  v_claimed UUID;
  v_display TEXT := coalesce(
                      nullif(trim(p_display_name), ''),
                      nullif(trim(concat_ws(' ', nullif(trim(p_first_name), ''),
                                                 nullif(trim(p_last_name), ''))), ''));
BEGIN
  -- No email AND no claimer AND no explicit name-only opt-in → a name-only
  -- guest (weak signal). Do NOT auto-seed; signal "skip" to the caller so it
  -- leaves the link null until a confirm (or, for a cluster match, until the
  -- caller below has already established a bounded reason to trust it).
  IF v_email IS NULL AND p_claimer IS NULL AND NOT p_allow_name_only THEN
    RETURN NULL;
  END IF;

  LOOP
    -- (a) Find by email (the dedup anchor). A name-only creation has no
    -- email to find by, so this branch is simply skipped for it.
    v_id := NULL;
    IF v_email IS NOT NULL THEN
      SELECT person_id, claimed_by_user_id INTO v_id, v_claimed
      FROM public.people
      WHERE lower(email) = v_email AND deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
      -- Found. If a claimer is present and the node is still unclaimed, CLAIM it
      -- ("your history was waiting") and fill any blank profile fields. The
      -- `claimed_by_user_id IS NULL` guard makes a concurrent double-claim a no-op.
      IF p_claimer IS NOT NULL AND v_claimed IS NULL THEN
        UPDATE public.people SET
          claimed_by_user_id = p_claimer,
          display_name       = coalesce(display_name, v_display),
          first_name         = coalesce(first_name, p_first_name),
          last_name          = coalesce(last_name, p_last_name),
          phone              = coalesce(phone, p_phone),
          profile_photo_url  = coalesce(profile_photo_url, p_photo_url),
          birth_date         = coalesce(birth_date, p_birth_date)
        WHERE person_id = v_id AND claimed_by_user_id IS NULL;
      END IF;
      RETURN v_id;
    END IF;

    -- (b) Not found → create. Race-safe: a concurrent create of the same email
    -- raises unique_violation; catch it and loop back to the find branch.
    -- A name-only create (v_email IS NULL) can never hit that unique index,
    -- so it always takes this branch exactly once — by design, it is the
    -- caller's job (resolve_cluster_guest_person) to have already checked
    -- there is nobody to find.
    BEGIN
      INSERT INTO public.people (
        claimed_by_user_id, created_by_user_id,
        display_name, first_name, last_name, email, phone, profile_photo_url, birth_date
      ) VALUES (
        p_claimer, coalesce(p_creator, p_claimer),
        v_display, p_first_name, p_last_name, v_email, p_phone, p_photo_url, p_birth_date
      )
      RETURNING person_id INTO v_id;
      RETURN v_id;
    EXCEPTION WHEN unique_violation THEN
      -- another txn created this email first — retry the SELECT.
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID,BOOLEAN) IS
  'Person-spine identity resolver: find a person by email, claim it for p_claimer if unclaimed, else create. Email-keyed dedup; name-only (no email, no claimer) returns NULL unless p_allow_name_only is TRUE, which only resolve_cluster_guest_person() passes, and only after it has already confirmed a bounded, same-cluster, same-name sibling exists. Used by self-claim, sign-up matching, email-keyed guest seeding, and the cluster guest matcher.';

-- 🪤 THE REVOKE IS LOAD-BEARING (same trap 7a documented for tables — it
-- applies to functions too). A CREATE FUNCTION with no following REVOKE
-- leaves the default PUBLIC EXECUTE grant in place, and this function is
-- SECURITY DEFINER, does its OWN authorization for NOTHING (it trusts
-- p_claimer verbatim), and is reachable at /rest/v1/rpc/resolve_or_claim_person
-- by anyone holding the publishable anon key. It exists to be called from
-- INSIDE other SECURITY DEFINER trigger functions (ensure_person_for_user,
-- set_guest_person, resolve_cluster_guest_person), which need no EXECUTE
-- grant of their own — a SECURITY DEFINER function runs as its owner, and
-- the owner implicitly has EXECUTE on functions it owns. It is not meant to
-- be called directly by anyone over PostgREST.
REVOKE ALL ON FUNCTION public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID,BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID,BOOLEAN) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. resolve_cluster_guest_person() — the bounded name match. SECURITY
--    DEFINER because it reads/writes public.people and other events'
--    public.guests rows past RLS, same posture as set_guest_person() itself
--    (it already runs as the trigger owner and writes rows outside NEW).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_cluster_guest_person(
  p_event_id    UUID,
  p_first_name  TEXT,
  p_last_name   TEXT,
  p_creator     UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cluster_id  UUID;
  v_first       TEXT := lower(nullif(trim(p_first_name), ''));
  v_last        TEXT := lower(nullif(trim(p_last_name), ''));
  v_match_guest UUID;
  v_match_person UUID;
  v_new_person  UUID;
BEGIN
  -- No name at all → nothing to match on.
  IF v_first IS NULL AND v_last IS NULL THEN
    RETURN NULL;
  END IF;

  -- UNCLUSTERED celebrations never merge — this is the guard, not an
  -- optimisation. A celebration can belong to at most one cluster
  -- (UNIQUE (event_id) on event_cluster_members, 20271189765490), so this is
  -- at most one row.
  SELECT event_cluster_id INTO v_cluster_id
  FROM public.event_cluster_members
  WHERE event_id = p_event_id;

  IF v_cluster_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- A same-name guest in a DIFFERENT celebration of the SAME cluster.
  -- Earliest first, so a third celebration converges on the same node the
  -- second one already established rather than minting again.
  SELECT g.guest_id, g.person_id INTO v_match_guest, v_match_person
  FROM public.guests g
  JOIN public.event_cluster_members ecm ON ecm.event_id = g.event_id
  WHERE ecm.event_cluster_id = v_cluster_id
    AND g.event_id <> p_event_id
    AND g.deleted_at IS NULL
    AND lower(nullif(trim(g.first_name), '')) IS NOT DISTINCT FROM v_first
    AND lower(nullif(trim(g.last_name), ''))  IS NOT DISTINCT FROM v_last
  ORDER BY g.created_at
  LIMIT 1;

  IF v_match_guest IS NULL THEN
    RETURN NULL;  -- nobody to unify with (yet) — stays unlinked, same as today
  END IF;

  IF v_match_person IS NOT NULL THEN
    RETURN v_match_person;  -- the sibling already has a node — reuse it
  END IF;

  -- The sibling exists but has no person yet (both sides are still
  -- name-only) — mint one, scoped by the p_allow_name_only opt-in, and
  -- backfill the sibling row so both celebrations now point at it.
  v_new_person := public.resolve_or_claim_person(
    p_email           => NULL,
    p_first_name      => p_first_name,
    p_last_name       => p_last_name,
    p_creator         => p_creator,
    p_allow_name_only => TRUE
  );

  UPDATE public.guests SET person_id = v_new_person
  WHERE guest_id = v_match_guest AND person_id IS NULL;

  RETURN v_new_person;
END;
$$;

COMMENT ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) IS
  'ITEM 7b: given a guest''s event + name, find a same-name guest in ANOTHER celebration of the SAME event_cluster and return one shared person_id for both, minting a person if neither side has one yet. Returns NULL when the celebration has no cluster (UNCLUSTERED never merges), the name is blank, or no sibling matches. Scope is the caller''s own cluster only — never a global name index.';

-- Same trap, same fix: internal helper only, called from set_guest_person and
-- backfill_cluster_guest_matches (both SECURITY DEFINER, same owner). Not a
-- public RPC — an anon caller passing an arbitrary p_event_id/p_creator would
-- otherwise be able to graft a stranger's guest onto a person of their choosing.
REVOKE ALL ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wire it into the existing guest trigger — one more line, same trigger,
--    same call site as the email path. Only reached when the email resolver
--    (unchanged above it) returned NULL, i.e. the guest is name-only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_guest_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
BEGIN
  -- The event's couple/host is the node creator, so they can see it under RLS.
  SELECT em.user_id INTO v_host
  FROM public.event_members em
  WHERE em.event_id = NEW.event_id AND em.member_type = 'couple'
  ORDER BY em.user_id
  LIMIT 1;

  IF nullif(trim(NEW.email), '') IS NOT NULL THEN
    NEW.person_id := public.resolve_or_claim_person(
      p_email        => NEW.email,
      p_display_name => NEW.display_name,
      p_first_name   => NEW.first_name,
      p_last_name    => NEW.last_name,
      p_phone        => NEW.mobile,
      p_photo_url    => NEW.profile_photo_url,
      p_creator      => v_host
    );
    RETURN NEW;
  END IF;

  -- Name-only guest: the email path is not available. Try the bounded
  -- same-cluster name match; if there is nothing to unify with, this
  -- returns NULL and the row stays unlinked exactly as it does today.
  NEW.person_id := public.resolve_cluster_guest_person(
    NEW.event_id, NEW.first_name, NEW.last_name, v_host
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. A cluster can be formed AFTER its guests already exist — order must not
--    matter. When a celebration joins a cluster, give its current name-only
--    guests one pass of the same matching against their new siblings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_cluster_guest_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
  g RECORD;
BEGIN
  SELECT em.user_id INTO v_host
  FROM public.event_members em
  WHERE em.event_id = NEW.event_id AND em.member_type = 'couple'
  ORDER BY em.user_id
  LIMIT 1;

  FOR g IN
    SELECT guest_id, first_name, last_name
    FROM public.guests
    WHERE event_id = NEW.event_id
      AND deleted_at IS NULL
      AND person_id IS NULL
  LOOP
    UPDATE public.guests
    SET person_id = public.resolve_cluster_guest_person(
      NEW.event_id, g.first_name, g.last_name, v_host
    )
    WHERE guest_id = g.guest_id;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.backfill_cluster_guest_matches() IS
  'ITEM 7b: when a celebration JOINS a cluster, its existing name-only guests get one pass of resolve_cluster_guest_person against their new siblings — the guests may predate the cluster, and order must not change the outcome.';

DROP TRIGGER IF EXISTS backfill_cluster_guest_matches ON public.event_cluster_members;
CREATE TRIGGER backfill_cluster_guest_matches
  AFTER INSERT ON public.event_cluster_members
  FOR EACH ROW EXECUTE FUNCTION public.backfill_cluster_guest_matches();

-- A trigger function fires regardless of the inserting role's EXECUTE
-- privilege on it — the grant below is not needed for the trigger to run,
-- only to keep it OFF the direct RPC surface (same reasoning as above).
REVOKE ALL ON FUNCTION public.backfill_cluster_guest_matches() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_cluster_guest_matches() FROM anon;
REVOKE ALL ON FUNCTION public.backfill_cluster_guest_matches() FROM authenticated;

-- ---------------------------------------------------------------------------
-- 5. cluster_guest_roster() — the read shape: one row per resolved person,
--    their per-celebration guest rows underneath. SECURITY INVOKER (the
--    default — no SECURITY DEFINER here on purpose) so it runs as the
--    calling user and inherits the EXISTING RLS on both tables it reads
--    rather than inventing a ninth pattern:
--      · public.guests            — event_member_can_read_guest (current_event_ids())
--      · public.event_cluster_members — event_cluster_members_read (owner-or-couple)
--    A stranger, or a guest who is not the couple, gets zero cluster
--    membership rows back and therefore zero roster rows — the same
--    guarantee a-year-holds-only-your-own-celebrations.db.test.ts already
--    proves for the membership table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cluster_guest_roster(p_event_cluster_id UUID)
RETURNS TABLE (
  identity_key    TEXT,
  person_id       UUID,
  display_name    TEXT,
  celebrations    JSONB
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    coalesce(g.person_id::TEXT, g.guest_id::TEXT) AS identity_key,
    g.person_id,
    coalesce(
      max(g.display_name),
      max(nullif(trim(concat_ws(' ', g.first_name, g.last_name)), ''))
    ) AS display_name,
    jsonb_agg(
      jsonb_build_object(
        'event_id',    g.event_id,
        'guest_id',    g.guest_id,
        'rsvp_status', g.rsvp_status
      )
      ORDER BY g.event_id
    ) AS celebrations
  FROM public.guests g
  JOIN public.event_cluster_members ecm ON ecm.event_id = g.event_id
  WHERE ecm.event_cluster_id = p_event_cluster_id
    AND g.deleted_at IS NULL
  GROUP BY coalesce(g.person_id::TEXT, g.guest_id::TEXT), g.person_id;
$$;

COMMENT ON FUNCTION public.cluster_guest_roster(UUID) IS
  'ITEM 7b build item 3 — the planner''s view: one row per resolved person across a cluster''s celebrations, with their per-celebration guest rows nested underneath. SECURITY INVOKER: no elevated rights, inherits the caller''s existing RLS on guests and event_cluster_members. A name-only guest with no cluster-mate match is still one row, keyed by their own guest_id (identity_key), so nobody is dropped from the roster for lack of a match.';

-- 🪤 THE REVOKE IS LOAD-BEARING here too. cluster_guest_roster is SECURITY
-- INVOKER (safe by construction — RLS on the tables it reads still applies
-- to whoever calls it), but the default PUBLIC EXECUTE grant would still let
-- an anon caller invoke it directly over PostgREST. RLS makes that harmless
-- (an unauthenticated caller sees zero rows), but the exposure guard tracks
-- the RPC surface itself, not just its runtime safety — narrow it anyway.
REVOKE ALL ON FUNCTION public.cluster_guest_roster(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cluster_guest_roster(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cluster_guest_roster(UUID) TO authenticated, service_role;

COMMIT;
