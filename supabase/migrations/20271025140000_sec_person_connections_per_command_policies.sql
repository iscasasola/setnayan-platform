-- 20271025140000_sec_person_connections_per_command_policies.sql
--
-- SEC · person_connections — split the FOR ALL policy so "mutual confirmation
--       is consent" is enforced by the DATABASE, not only by a server action.
--
-- THE HOLE. 20270514787557 shipped ONE policy:
--
--   CREATE POLICY person_connections_participant ON public.person_connections
--     FOR ALL
--     USING      (is_admin() OR I own from_person OR I own to_person)
--     WITH CHECK (is_admin() OR I own from_person OR I own to_person);
--
-- No `TO` clause (so it applies to PUBLIC), USING identical to WITH CHECK, and —
-- the load-bearing omission — NO PREDICATE ON `status`. The migration also
-- carried no REVOKE, so anon/authenticated hold SIUD by Supabase default ACL.
--
-- Consequence: the whole legal basis of the family tree lives in the server
-- action. PostgREST is reachable with the publishable key plus any user JWT, so
-- a user could INSERT a row with status='confirmed' directly — forging a
-- spouse/parent/child edge onto a person who never agreed — or UPDATE their own
-- pending edge straight to confirmed. `visible_connection_names()` gates on
-- status='confirmed', so that also turns the graph into an email → real-name
-- oracle.
--
-- The counsel-facing rule this restores (People_Graph 2026-07-04, and the
-- 2026-07-17 branches-vs-leaves lock): an edge is personal data of BOTH
-- endpoints. It may be PROPOSED by one and only CONFIRMED by the other.
--
-- WHY A SPLIT AND NOT A REVOKE. Routing writes through SECURITY DEFINER RPCs
-- was the cheaper option, but it (a) adds new grantable functions — which is
-- itself an exposure widening, see 20271025100000's note on Supabase default
-- privileges — and (b) rewrites four live call sites. The policies below encode
-- exactly what people/actions.ts already does, so no app change is needed:
--   · propose  → insert { from_person_id: mine, to_person_id, status:'pending' }
--   · confirm  → update { status:'confirmed' } where to_person_id = mine and status='pending'
--   · decline  → update { status:'declined'  } where to_person_id = mine and status='pending'
--
-- ⚠ THE BASELINE. New PERMISSIVE policies read as WIDENING to the exposure
-- freeze even when every one of them is strictly narrower. The regenerated
-- baseline ships in this PR, and this PR is stacked on the honoree lock so the
-- baseline it records already contains that narrowing — regenerating from an
-- older main would have re-frozen the exposure that PR just closed.

-- ── 0 · Close the default-ACL lane first ────────────────────────────────────
-- Every new table in `public` ships with arwdDxtm to anon+authenticated. The
-- defining migration never revoked, so anon holds INSERT/UPDATE/DELETE on a
-- table of consented relationship edges. anon has no person node and can never
-- legitimately write here.
REVOKE ALL ON public.person_connections FROM anon;
-- SELECT, INSERT, UPDATE only — NOT DELETE. The first draft granted DELETE to
-- pair with a disconnect policy, and the regenerated baseline caught it:
--     -tpriv public.person_connections|authenticated SIU
--     +tpriv public.person_connections|authenticated SIUD
-- authenticated never held DELETE here, nothing in apps/web deletes a
-- connection, and disconnect is not built. Granting it "for later" would have
-- made a narrowing PR widen the surface. Disconnect ships with its own grant,
-- its own policy and its own review — the 2026-07-15 lock is mutual DATA
-- SEPARATION, which is a bigger design than a row delete anyway.
GRANT SELECT, INSERT, UPDATE ON public.person_connections TO authenticated;
GRANT ALL ON public.person_connections TO service_role;

-- ── 1 · Replace the single FOR ALL with four per-command policies ───────────
DROP POLICY IF EXISTS person_connections_participant ON public.person_connections;

-- Helper predicate, inlined into each policy (no new function — a new function
-- in `public` is itself a published surface).
--   "I own person X" = a people row for X claimed by me.

-- SELECT · unchanged reach: either endpoint, or an admin. Reading your own
-- pending proposals is how the confirm UI works at all.
CREATE POLICY person_connections_select ON public.person_connections
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.person_id = person_connections.from_person_id AND p.claimed_by_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.person_id = person_connections.to_person_id   AND p.claimed_by_user_id = auth.uid())
  );

-- INSERT · you may only PROPOSE, and only ever FROM yourself. status is pinned
-- to 'pending': this is the line that makes forging a confirmed edge impossible.
CREATE POLICY person_connections_propose ON public.person_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND confirmed_at IS NULL
    AND declined_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.from_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
    -- an edge to yourself is not a relationship
    AND from_person_id <> to_person_id
  );

-- UPDATE · only the RECIPIENT answers, only a PENDING edge, and only into a
-- terminal answer. USING gates the pre-image, WITH CHECK the post-image — both
-- are required: USING alone would let the recipient rewrite a settled edge.
CREATE POLICY person_connections_answer ON public.person_connections
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.to_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('confirmed', 'declined')
    AND EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.to_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
  );

-- DELETE · deliberately NO policy and NO grant. Disconnect is unbuilt and
-- authenticated has never held DELETE on this table; see the note in §0.

-- Admin write lane, kept explicit rather than folded into the user policies so
-- an admin's reach is visible in \dp rather than hidden inside an OR leg.
CREATE POLICY person_connections_admin_write ON public.person_connections
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 2 · Pin the answer timestamps server-side ───────────────────────────────
-- The client sends confirmed_at/declined_at. Harmless today, but a
-- self-asserted timestamp on a consent record is not evidence — stamp it.
CREATE OR REPLACE FUNCTION public.person_connections_stamp_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    NEW.confirmed_at := now();
    NEW.declined_at  := NULL;
  ELSIF NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
    NEW.declined_at  := now();
    NEW.confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
-- A trigger function is not callable via PostgREST (it takes no args and
-- returns TRIGGER), so it adds no published surface — unlike a plain helper.
REVOKE ALL ON FUNCTION public.person_connections_stamp_answer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS person_connections_stamp_answer_trg ON public.person_connections;
CREATE TRIGGER person_connections_stamp_answer_trg
  BEFORE UPDATE ON public.person_connections
  FOR EACH ROW EXECUTE FUNCTION public.person_connections_stamp_answer();

-- ── 3 · Post-conditions ─────────────────────────────────────────────────────
DO $$
DECLARE
  n INT;
BEGIN
  -- (a) the FOR ALL user policy is gone
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='person_connections'
       AND policyname='person_connections_participant'
  ) THEN
    RAISE EXCEPTION 'person_connections_participant still present — the FOR ALL lane is open';
  END IF;

  -- (b) exactly the four expected policies exist
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname='public' AND tablename='person_connections';
  IF n <> 4 THEN
    RAISE EXCEPTION 'expected 4 policies on person_connections, found %', n;
  END IF;

  -- (c) anon holds nothing
  IF has_table_privilege('anon', 'public.person_connections', 'INSERT')
     OR has_table_privilege('anon', 'public.person_connections', 'UPDATE')
     OR has_table_privilege('anon', 'public.person_connections', 'SELECT') THEN
    RAISE EXCEPTION 'anon still holds privileges on person_connections';
  END IF;

  -- (c2) and authenticated did NOT gain DELETE — this PR must only narrow
  IF has_table_privilege('authenticated', 'public.person_connections', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated gained DELETE on person_connections — this PR must not widen';
  END IF;

  -- (d) RLS is on (a policy set is decorative without it)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.person_connections'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on person_connections';
  END IF;
END $$;

COMMENT ON TABLE public.person_connections IS
  'Person-spine PHASE 2 connections graph (counsel-gated). Directed edges: relation = what to_person is to from_person. MUTUAL CONFIRMATION IS ENFORCED IN THE DATABASE as of 20271025140000: INSERT may only create status=pending from a person you own; UPDATE may only be performed by the RECIPIENT, only on a pending row, and only into confirmed/declined. Family first-degree only; extended kin derived. Ritual kinship = godparent/godchild (event-created). Adults-first; minors = Phase 3.';
