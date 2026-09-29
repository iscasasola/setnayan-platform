-- a_name_never_inherits_an_account
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ============================================================================
-- A NAME NEVER INHERITS AN ACCOUNT (2026-09-30 — the owner's own wedding).
--
-- A test account was bound to the owner's GROOM row, and the
-- `link_guest_to_account_person` trigger re-pointed that row's person_id at the
-- test account's person. `resolve_cluster_guest_person` (20271191258098, item
-- 7b) then made that mistake CONTAGIOUS: for any name-only guest row in another
-- celebration of the same cluster, a same-first-and-last-name sibling that
-- carries a person_id hands that person over — including a person CLAIMED by an
-- account. A typed name is not evidence of who someone is; the resolver's own
-- rule (resolve_or_claim_person) refuses a name-only match for exactly that
-- reason, and 7b's bounded exception was argued for UNCLAIMED name-only nodes.
--
-- 🔒 THE GATE: a sibling's person is inherited by name ONLY when nobody has
-- claimed it. A claimed person — somebody's account — joins a guest row only
-- on account evidence: the email path (set_guest_person), or the account's own
-- binding (link_guest_to_account_person). Everything 7b does for name-only
-- people is unchanged: two unclaimed rows still converge on one node, and a
-- sibling with no person still mints one.
--
-- Why it matters beyond tidiness: `is_event_celebrant` counts a user whose
-- claimed person sits on a celebrant row, and `guestIsCreator` (the Access
-- control) reads the same person_id. Inheriting a claimed person by name could
-- make a stranger a celebrant of an event they were never bound to.
--
-- Same signature, same body except the one gate. CREATE OR REPLACE keeps the
-- REVOKEs from 20271191258098; they are re-stated below anyway so this file is
-- correct on its own.
-- ============================================================================

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
  IF v_first IS NULL AND v_last IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT event_cluster_id INTO v_cluster_id
  FROM public.event_cluster_members
  WHERE event_id = p_event_id;

  IF v_cluster_id IS NULL THEN
    RETURN NULL;
  END IF;

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
    RETURN NULL;
  END IF;

  IF v_match_person IS NOT NULL THEN
    -- 🔒 THE GATE. A person somebody's ACCOUNT has claimed is never handed over
    -- on a name — the row stays unlinked until that account binds it itself.
    IF EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.person_id = v_match_person
        AND p.claimed_by_user_id IS NOT NULL
    ) THEN
      RETURN NULL;
    END IF;
    RETURN v_match_person;  -- an unclaimed, name-only node — reuse it (7b)
  END IF;

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
  'ITEM 7b: given a guest''s event + name, find a same-name guest in ANOTHER celebration of the SAME event_cluster and return one shared person_id for both, minting a person if neither side has one yet. Returns NULL when the celebration has no cluster, the name is blank, no sibling matches — or (2026-09-30) the sibling''s person is CLAIMED by an account: a name never inherits an account. Scope is the caller''s own cluster only.';

REVOKE ALL ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_cluster_guest_person(UUID,TEXT,TEXT,UUID) FROM authenticated;
