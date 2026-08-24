-- ============================================================================
-- AN ACCEPTED DELEGATE IS A MEMBER OF THE EVENT.
--
-- Owner ruling, 2026-08-24, asked directly and answered: "Full helper access" —
-- when the couple's invited delegate accepts, they become a proper helper on
-- the event. They see what the coordinator role sees: the checklist, schedule,
-- appointments, the working planning surfaces — including private planning,
-- which the owner weighed and chose. Couple-only tables (Papic captures among
-- them) stay couple-only: this grants the COORDINATOR role, it does not touch
-- a single policy.
--
-- ── THE DEFECT THIS CLOSES, verified live ───────────────────────────────────
-- Two membership lists exist: event_members (what 117 tables' policies gate
-- on; 86 of them have NO moderator path) and event_moderators (what the
-- dashboard shell admits). The token-accept door mints an event_members
-- 'coordinator' row two lines after stamping accepted_at. The access-request
-- approval door creates the moderator row BORN-ACCEPTED ("there is no
-- invitation left to accept") and never mints — and a row seeded straight into
-- the database passes no app door at all.
--
-- Production holds exactly that: one accepted wedding_planner_external on an
-- event with 94 checklist items, created_at = accepted_at to the microsecond
-- (both from one DB now() — an insert born accepted), no member row. An RLS
-- denial is 200 + zero rows + null error, so that planner opens the checklist
-- and reads an EMPTY list — a wedding that looks unplanned. Same mechanism as
-- 4ba5ced17 ("0 cameras out" mid-shoot). ONE WRITE BODY, TWO DOORS — and the
-- second door forgot half the write.
--
-- ── WHY A TRIGGER AND NOT THE SERVER ACTIONS ────────────────────────────────
-- The doors are at least three (token accept · access-request approval ·
-- direct SQL, which is how the live row arrived) and the next one has not been
-- written yet. 20271150589049 and 20271138150255 put this class of duty in the
-- database for exactly this reason. The app-side upsert in
-- app/host/accept/[token]/actions.ts is REMOVED in the same PR so the trigger
-- is the one writer; the db test proves that door still mints.
--
-- ── THE INVERSE, BUILT AT WRITE TIME ────────────────────────────────────────
-- A forward primitive with no inverse permanently strands what it creates
-- (the auto-block lesson, 2026-08-09). Removal already deletes the coordinator
-- membership in app code (hosts/actions.ts) — the trigger carries the same
-- inverse so seeded/SQL removals revoke too:
--   removed_at stamped → delete the 'coordinator' member row, ONLY if no other
--   accepted, live moderator row exists for that (event, user).
-- ON CONFLICT DO NOTHING means a couple member is never downgraded, and the
-- delete names member_type='coordinator' so a couple row is never deleted.
--
-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- Accepted, live, user-bearing moderator rows lacking membership. In prod
-- today: exactly ONE row (the planner above). Idempotent by the same conflict.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_delegate_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Forward: an accepted, live, claimed delegate is a coordinator member.
  IF NEW.accepted_at IS NOT NULL
     AND NEW.removed_at IS NULL
     AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
    VALUES (NEW.event_id, NEW.user_id, 'coordinator', 'invited')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  -- Inverse: removal revokes the membership this trigger minted — never a
  -- couple row. The "another live accepted role remains" guard is a BELT:
  -- event_moderators holds UNIQUE (event_id, user_id) today, so it cannot
  -- fire — and the db test pins that premise so whoever relaxes the UNIQUE
  -- is told this branch just became load-bearing.
  IF NEW.removed_at IS NOT NULL
     AND NEW.user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.event_moderators m
       WHERE m.event_id = NEW.event_id
         AND m.user_id = NEW.user_id
         AND m.moderator_id <> NEW.moderator_id
         AND m.accepted_at IS NOT NULL
         AND m.removed_at IS NULL
     ) THEN
    DELETE FROM public.event_members
    WHERE event_id = NEW.event_id
      AND user_id = NEW.user_id
      AND member_type = 'coordinator';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_delegate_membership() IS
  'Owner ruling 2026-08-24: an accepted delegate is a coordinator member of the '
  'event. AFTER trigger on event_moderators — the one writer of that membership; '
  'the token-accept action''s copy was removed the same day. Inverse included: '
  'removal deletes the coordinator row unless another live accepted role remains. '
  'Never touches couple rows (insert conflicts out; delete names coordinator).';

DROP TRIGGER IF EXISTS sync_delegate_membership ON public.event_moderators;
CREATE TRIGGER sync_delegate_membership
AFTER INSERT OR UPDATE OF accepted_at, removed_at, user_id
ON public.event_moderators
FOR EACH ROW
EXECUTE FUNCTION public.sync_delegate_membership();

-- Backfill the doors that already fired. Idempotent.
INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
SELECT m.event_id, m.user_id, 'coordinator', 'invited'
FROM public.event_moderators m
WHERE m.accepted_at IS NOT NULL
  AND m.removed_at IS NULL
  AND m.user_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;
