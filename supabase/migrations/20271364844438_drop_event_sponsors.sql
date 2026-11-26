-- ============================================================================
-- 20271364844438_drop_event_sponsors.sql
--
-- DROP `event_sponsors` — owner 27 Nov 2026: drop it (brief Add 41, A2-I14).
--
-- 20271363480132_sponsors_join_the_guest_list.sql (which sorts BEFORE this file) linked every
-- `event_sponsors` row to the guest it already is, or copied it into `guests` with the sponsor
-- role, the reply, the walking pair and `sponsor_asked_at`. From then on the Sponsors page reads
-- and writes `guests` only (`apps/web/lib/sponsor-guests.ts`); nothing in the app writes or reads
-- `event_sponsors`. The owner ruled the old table is dropped rather than kept as a record.
--
-- What else named it, and what happens to it here:
--   · generate_event_connections(uuid, uuid) — LIVE (the flag-guarded People-connections server
--     action, called after every Sponsors save). Its godparent loop read accepted principal
--     sponsors FROM event_sponsors: a plpgsql read a DROP cannot see, so it would raise at
--     runtime. RE-CREATED below from its latest body (20270515967165; 20271026206007 only changed
--     its grants) with that one loop reading the guest list instead: a guest on the event, not
--     deleted, holding a principal_sponsor* role (as `role` or in `extra_roles`) whose reply is
--     'attending' — exactly what `sponsorsFromGuests` shows as an accepted principal sponsor.
--     Everything else is the same. CREATE OR REPLACE keeps its grants (authenticated, service_role).
--   · RLS policies (event_sponsors_host_all, lh_ro_{ins,upd,del}_event_sponsors), the
--     updated_at trigger and the FK constraints go with the table.
--   · tg_event_sponsors_set_updated_at() — the table's own trigger function, nothing else uses
--     it. DROPPED after the table.
--   · No view, and no other table's foreign key, points at event_sponsors. The one-time DO blocks
--     in 20271302707661 and 20271363480132 already ran (and guard on to_regclass / run first).
--
-- Every statement IF EXISTS / CREATE OR REPLACE, so a re-apply is a no-op.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge.
-- ============================================================================

BEGIN;

-- ── 1 · generate_event_connections: godparents come from the guest list ──────
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
  --    each resolved principal. A sponsor is a guest with a principal_sponsor*
  --    role (brief Add 41); accepted = their reply is 'attending'. They resolve
  --    via the guest's own person, else find-or-create by email. No person and
  --    no email ⇒ no edge.
  IF array_length(v_principals, 1) >= 1 THEN
    FOR v_sponsor IN
      SELECT g.email AS email, g.person_id AS linked_person
        FROM public.guests g
       WHERE g.event_id = p_event_id
         AND g.deleted_at IS NULL
         AND g.rsvp_status = 'attending'
         AND (g.role::text LIKE 'principal_sponsor%'
              OR EXISTS (SELECT 1 FROM unnest(g.extra_roles) r WHERE r::text LIKE 'principal_sponsor%'))
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
  'Person-spine PHASE 2 (counsel-gated, flag-off): derive proposal connection edges from a ceremony. Wedding only (adults-first): spouse edge (bride↔groom guests) + godparent edges (accepted principal sponsors — guests with a principal_sponsor* role replying attending — → each principal). Edges are pending (mutually confirmed later); idempotent; needs both sides to resolve to a person (no name-only fabrication). Sole caller is the flag-guarded generateEventConnections server action.';

-- ── 2 · the table, then its own trigger function ─────────────────────────────
DROP TABLE IF EXISTS public.event_sponsors;
DROP FUNCTION IF EXISTS public.tg_event_sponsors_set_updated_at();

COMMIT;
