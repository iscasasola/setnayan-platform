-- phase2 generate event connections
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE OR REPLACE FUNCTION …
--   • GRANT/REVOKE are idempotent

-- ============================================================================
-- Person-spine · PHASE 2 · EVENT-CREATED connection edges (owner "resume now"
-- 2026-07-05 — STAGED / flag-off).
--
-- ⚠ PHASE 2 IS COUNSEL-GATED. This migration ships a SQL function ONLY. It is
-- never called in production while the People-connections feature flag is OFF —
-- the sole caller is a server action (`generateEventConnections`) that hard-
-- guards on `peopleConnectionsEnabled()`. No relationship data is written until
-- PH counsel signs off and the owner flips the flag. Plan: 03_Strategy/
-- People_Graph_and_Lifelong_Identity_2026-07-04.md §11.
--
-- What it does (locked model): the CEREMONY generates the edge. For a WEDDING
-- (kasal) it derives, from data the host already filled in:
--   • the SPOUSE edge — between the two principals (guests role bride ↔ groom)
--   • GODPARENT edges (ritual kinship, ninong/ninang) — from each ACCEPTED
--     principal sponsor to each principal.
-- Edges are inserted as PROPOSALS (status 'pending') — still mutually confirmed
-- by the other side via the existing confirm flow. Nothing auto-connects.
--
-- Guardrails, structural (not just policy):
--   • ADULTS-FIRST — only weddings. Wedding spouses + principal sponsors are
--     adults. binyag/kumpil (whose godchild is a MINOR) are Phase 3 and are not
--     handled here; any non-wedding event returns 0.
--   • NO retroactive fabrication — an edge needs BOTH sides to already resolve
--     to a person node (a guest with a linked account/email, or an accepted
--     sponsor with an email). Name-only rows produce NO edge; the graph builds
--     forward, it is not an ancestry backfill.
--   • IDEMPOTENT — re-running never duplicates (ON CONFLICT on the edge index);
--     safe to call after every roster edit.
--   • Never a self-edge (from_person <> to_person enforced + filtered).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- generate_event_connections(p_event_id, p_creator)
--   Returns the number of NEW edges inserted. SECURITY DEFINER so it can read
--   guests/event_sponsors and insert edges regardless of RLS — the CALLER
--   (server action) is responsible for authorizing that p_creator hosts the
--   event and that the feature flag is on.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_event_connections(
  p_event_id UUID,
  p_creator  UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_type  TEXT;
  v_bride       UUID;
  v_groom       UUID;
  v_principals  UUID[];
  v_sponsor     RECORD;
  v_sponsor_pid UUID;
  v_principal   UUID;
  v_inserted    INTEGER := 0;
  v_rowcount    INTEGER;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Adults-first: only weddings create kinship edges in Phase 2.
  SELECT event_type::text INTO v_event_type
    FROM public.events
   WHERE event_id = p_event_id;
  IF v_event_type IS DISTINCT FROM 'wedding' THEN
    RETURN 0;
  END IF;

  -- The two principals — bride + groom guests that already resolve to a person.
  SELECT person_id INTO v_bride
    FROM public.guests
   WHERE event_id = p_event_id AND role = 'bride' AND person_id IS NOT NULL
   LIMIT 1;
  SELECT person_id INTO v_groom
    FROM public.guests
   WHERE event_id = p_event_id AND role = 'groom' AND person_id IS NOT NULL
   LIMIT 1;

  -- 1) SPOUSE edge (family layer). One directed proposal; the confirm flow
  --    makes it mutual. Skipped unless both principals resolve to a person.
  IF v_bride IS NOT NULL AND v_groom IS NOT NULL AND v_bride <> v_groom THEN
    INSERT INTO public.person_connections
      (from_person_id, to_person_id, relation, layer, status, created_by_event_id, created_by_user_id)
    VALUES
      (v_bride, v_groom, 'spouse', 'family', 'pending', p_event_id, p_creator)
    ON CONFLICT (from_person_id, to_person_id, relation) WHERE deleted_at IS NULL
    DO NOTHING;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    v_inserted := v_inserted + v_rowcount;
  END IF;

  -- Collect whichever principals exist (0, 1, or 2) for the sponsor edges.
  v_principals := ARRAY(SELECT p FROM unnest(ARRAY[v_bride, v_groom]) AS p WHERE p IS NOT NULL);

  -- 2) GODPARENT edges (ritual layer) — every ACCEPTED principal sponsor to
  --    each resolved principal. Sponsors resolve via their linked guest's
  --    person, else find-or-create by email. No email + no link ⇒ no edge.
  IF array_length(v_principals, 1) >= 1 THEN
    FOR v_sponsor IN
      SELECT es.email AS email, g.person_id AS linked_person
        FROM public.event_sponsors es
        LEFT JOIN public.guests g ON g.guest_id = es.linked_guest_id
       WHERE es.event_id = p_event_id
         AND es.sponsor_tier = 'principal'
         AND es.invitation_status = 'accepted'
    LOOP
      v_sponsor_pid := v_sponsor.linked_person;
      IF v_sponsor_pid IS NULL AND nullif(trim(coalesce(v_sponsor.email, '')), '') IS NOT NULL THEN
        v_sponsor_pid := public.resolve_or_claim_person(
          p_email   => v_sponsor.email,
          p_creator => p_creator
        );
      END IF;
      CONTINUE WHEN v_sponsor_pid IS NULL;

      FOREACH v_principal IN ARRAY v_principals LOOP
        IF v_sponsor_pid <> v_principal THEN
          INSERT INTO public.person_connections
            (from_person_id, to_person_id, relation, layer, status, created_by_event_id, created_by_user_id)
          VALUES
            (v_sponsor_pid, v_principal, 'godparent', 'ritual', 'pending', p_event_id, p_creator)
          ON CONFLICT (from_person_id, to_person_id, relation) WHERE deleted_at IS NULL
          DO NOTHING;
          GET DIAGNOSTICS v_rowcount = ROW_COUNT;
          v_inserted := v_inserted + v_rowcount;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.generate_event_connections(UUID, UUID) IS
  'Person-spine PHASE 2 (counsel-gated, flag-off): derive proposal connection edges from a ceremony. Wedding only (adults-first): spouse edge (bride↔groom guests) + godparent edges (accepted principal sponsors → each principal). Edges are pending (mutually confirmed later); idempotent; needs both sides to resolve to a person (no name-only fabrication). Sole caller is the flag-guarded generateEventConnections server action.';

REVOKE ALL ON FUNCTION public.generate_event_connections(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_event_connections(UUID, UUID) TO authenticated, service_role;
