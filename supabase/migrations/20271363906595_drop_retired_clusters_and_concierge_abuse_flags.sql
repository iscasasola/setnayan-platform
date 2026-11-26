-- ============================================================================
-- 20271363906595_drop_retired_clusters_and_concierge_abuse_flags.sql
--
-- DROP THE SCHEMA OF TWO RETIRED PAGES (owner ruling, 25 Nov 2026, final check R7 / PR #8346).
--
-- PR #8346 retired /dashboard/clusters ("years you grouped", ITEM 7 "the year") and the
-- /admin/concierge-abuse desk. That left three tables with no writer anywhere in the app
-- (tests/db/ugat-both-ends.db.test.ts: `table-no-writer`). The owner ruled: DROP all three.
-- Rows in them are discarded by that ruling.
--   event_cluster_members · event_clusters   — the linked-cluster primitive (20271189765490)
--   concierge_abuse_flags                    — the AI Concierge trial-abuse queue (20260518000000)
--
-- What else named them, and what happens to it here:
--   · cluster_guest_roster(uuid), cluster_timeline(uuid) — the clusters page's two reads
--     (20271191258098, 20271192016913). DROPPED.
--   · backfill_cluster_guest_matches() + its AFTER INSERT trigger on event_cluster_members —
--     exists only for clusters. DROPPED (the trigger goes with its table; dropped explicitly first).
--   · resolve_cluster_guest_person(uuid,text,text,uuid) — the same-cluster name match
--     (20271254506023). Its only callers are set_guest_person and the backfill above. DROPPED.
--   · set_guest_person() — the guests BEFORE INSERT OR UPDATE OF email trigger, LIVE and kept.
--     Its no-email branch called resolve_cluster_guest_person, a plpgsql call a DROP cannot see,
--     so it would raise at runtime on every name-only guest. RE-CREATED below from its latest
--     definition (20271255305468) with that one call replaced by its only possible result once
--     no cluster exists: NULL. Everything else is byte-for-byte the same.
--   · resolve_or_claim_person(…) — kept untouched. It never read the cluster tables (only a
--     comment named the matcher); its COMMENT is refreshed so it stops naming a dropped function.
--   · No other table has a foreign key into event_clusters / event_cluster_members, and no view
--     or other function reads any of the three tables. RLS policies go with their tables.
--   · users.concierge_abuse_strike_count is a column on users, not part of this drop.
--
-- ORDER: the live trigger function first (so no window where it calls a dropped function), then
-- the cluster-only functions, then the tables children-first. Every statement IF EXISTS /
-- CREATE OR REPLACE, so a re-apply is a no-op.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge.
-- ============================================================================

BEGIN;

-- ── 1 · set_guest_person: the name-only branch no longer asks a cluster ───────
CREATE OR REPLACE FUNCTION public.set_guest_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
BEGIN
  SELECT em.user_id INTO v_host
  FROM public.event_members em
  WHERE em.event_id = NEW.event_id AND em.member_type = 'couple'
  ORDER BY em.user_id
  LIMIT 1;

  IF nullif(trim(NEW.email), '') IS NOT NULL THEN
    -- 🔒 THE GATE: a couple row's address counts only if it is a couple
    -- member's own. Anything else leaves person_id as the statement set it.
    IF (NEW.role::text IN ('bride', 'groom', 'celebrant')
        OR coalesce(NEW.extra_roles::text[], '{}') && ARRAY['bride', 'groom', 'celebrant'])
       AND NOT EXISTS (
         SELECT 1
         FROM public.event_members em
         JOIN public.users u ON u.user_id = em.user_id
         WHERE em.event_id = NEW.event_id
           AND em.member_type = 'couple'
           AND lower(trim(u.email)) = lower(trim(NEW.email))
       ) THEN
      RETURN NEW;
    END IF;

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

  -- Name-only guest: no email to resolve by. This was the same-cluster name
  -- match, which returned NULL whenever the celebration had no cluster; with
  -- clusters dropped that is the only outcome left, kept exactly.
  NEW.person_id := NULL;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_guest_person() IS
  'Person-spine: resolve a guest row''s person from its email; a name-only row is left unlinked (person_id NULL). 2026-09-30: on a COUPLE row (bride/groom/celebrant, primary or extra role) the email resolves the person only when it belongs to an account that is already a couple member of the event — a typed address never makes its typist a celebrant. 2026-11-26: the same-cluster name match is gone with clusters.';

COMMENT ON FUNCTION public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID,BOOLEAN) IS
  'Person-spine identity resolver: find a person by email, claim it for p_claimer if unclaimed, else create. Email-keyed dedup; name-only (no email, no claimer) returns NULL unless p_allow_name_only is TRUE (no caller passes it since the cluster matcher was dropped, 2026-11-26). Used by self-claim, sign-up matching and email-keyed guest seeding.';

-- ── 2 · the cluster-only functions and trigger ───────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.event_cluster_members') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS backfill_cluster_guest_matches ON public.event_cluster_members;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.backfill_cluster_guest_matches();
DROP FUNCTION IF EXISTS public.resolve_cluster_guest_person(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.cluster_guest_roster(UUID);
DROP FUNCTION IF EXISTS public.cluster_timeline(UUID);

-- ── 3 · the tables, children first (their RLS policies and indexes go with them) ─
DROP TABLE IF EXISTS public.event_cluster_members;
DROP TABLE IF EXISTS public.event_clusters;
DROP TABLE IF EXISTS public.concierge_abuse_flags;

COMMIT;
