-- ============================================================================
-- A DAY-OF ANNOUNCEMENT IS SIGNED BY THE DATABASE, NOT BY THE BROWSER.
-- ============================================================================
--
-- Sibling of 20271132839561 (chat_messages), same defect family, same two-half
-- fix. Read that one first — this file only documents where the two DIFFER,
-- and they differ in one way that matters a great deal.
--
-- ── WHAT WAS POSSIBLE (measured against a full replay, before this file) ───
-- `coordinator_broadcasts` is what the couple or their day-of delegate sends
-- to every guest's phone during the event ("phones down, the ceremony is
-- starting"). The row carries who it is FROM, and guests are shown that label.
--
--   couple      inserting sender_role = 'coordinator'  → ACCEPTED
--   coordinator inserting sender_role = 'couple'       → ACCEPTED
--
-- Both INSERT policies pin `sender_user_id = auth.uid()`, so this is strictly
-- MILDER than the chat case: nobody can impersonate a different HUMAN. What
-- was forgeable is the ROLE LABEL — the couple could put the coordinator's
-- name on their own announcement, and the delegate could put the couple's name
-- on theirs. Guests cannot tell.
--
-- ── THE DIFFERENCE THAT MATTERS: THIS COLUMN HAS A DEFAULT ────────────────
-- chat_messages.sender_role is NOT NULL with NO default, so revoking the grant
-- without a working trigger fails LOUDLY — the insert simply cannot complete.
--
-- coordinator_broadcasts.sender_role is NOT NULL **DEFAULT 'coordinator'**.
-- Take the column away from the browser and something still fills it: the
-- default. In the pre-fix replay an honest couple insert that merely omitted
-- sender_role already landed labelled 'coordinator' — measured, not supposed.
--
-- So the obvious minimal fix — revoke sender_role, leave everything else —
-- would have signed EVERY couple announcement as the coordinator, silently,
-- with no error and nothing in a log. That is worse than the bug: the bug at
-- least required somebody to choose to lie.
--
-- What defuses it is revoking **sender_user_id as well**. Nothing then fills
-- that column either, and both INSERT policies require
-- sender_user_id = auth.uid() — so a missing trigger becomes a visible refusal
-- instead of a uniform mislabel. That revoke is therefore load-bearing here,
-- not belt-and-braces as it is on chat_messages.
--
-- Both directions are executed in the db test rather than argued: one case
-- drops the trigger and asserts the LOUD refusal, the other additionally
-- re-grants sender_user_id and asserts the silent 'coordinator' lie appears.
-- (The first was written expecting the silent lie; the run corrected it. The
-- correction is the reason this paragraph exists.)
--
-- ── WHO IS WHO ─────────────────────────────────────────────────────────────
-- Derivation mirrors the two INSERT policies branch for branch:
--   couple      ← a couple member of the event      (coordinator_broadcasts_couple_insert)
--   coordinator ← an accepted, not-removed delegate holding schedule='edit'
--                                                   (coordinator_broadcasts_moderator_insert)
-- Couple is tested FIRST, matching resolveBroadcastAuthority() in
-- lib/coordinator-broadcasts-server.ts, so somebody who is both resolves the
-- same way in the composer and in the row.
--
-- ── WHY NOT A HELPER FUNCTION ─────────────────────────────────────────────
-- The membership test is inline. A standalone SECURITY DEFINER function in
-- `public` is published by PostgREST at /rest/v1/rpc/ and is new public
-- surface; the chat migration's first cut did that and anon-rpc-surface
-- .db.test.ts + exposure-freeze.db.test.ts both refused it. A trigger function
-- cannot be reached over REST, so this adds no surface at all.
--
-- ── SCOPE ─────────────────────────────────────────────────────────────────
-- `created_at` also leaves the browser's reach, matching the chat migration:
-- announcements are shown newest-first, so choosing your own timestamp is
-- choosing your position in the guests' feed. DEFAULT now() does the work and
-- no app path names it. UPDATE is revoked and not re-granted — there is no
-- UPDATE policy today, so nothing changes now, and later nobody can hand the
-- sender columns back through a different verb. DELETE is untouched.
--
-- Service role is untouched: the erasure sweep and any future system-authored
-- notice keep their grants and keep stating their own sender.
-- ============================================================================

-- ── 1 · SIGN THE ANNOUNCEMENT BEFORE THE ROW LANDS ─────────────────────────
-- SECURITY INVOKER on purpose: it must read current_user to tell an end-user
-- session (PostgREST does SET LOCAL ROLE authenticated) from a service-role or
-- owner session. A DEFINER function would report the owner every time and this
-- branch would be dead code. The two membership lookups it calls are
-- themselves DEFINER, so nothing here needs rights of its own.
CREATE OR REPLACE FUNCTION public.tg_coordinator_broadcasts_derive_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_role text;
BEGIN
  -- The service role and the table owner are the server. Nothing to derive.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'coordinator_broadcasts: no signed-in identity to attribute this announcement to'
      USING ERRCODE = '42501';
  END IF;

  SELECT CASE
    -- A couple member of the event.
    WHEN NEW.event_id IN (SELECT public.current_couple_event_ids())
      THEN 'couple'
    -- An accepted, not-removed delegate holding schedule='edit'.
    WHEN public.moderator_area_level(NEW.event_id, 'schedule') = 'edit'
      THEN 'coordinator'
    ELSE NULL
  END INTO v_role;

  IF v_role IS NULL THEN
    -- RLS would refuse the row a moment later anyway; failing here makes the
    -- reason legible instead of a bare policy violation.
    RAISE EXCEPTION
      'coordinator_broadcasts: sender is not the couple or a schedule delegate on this event'
      USING ERRCODE = '42501';
  END IF;

  -- Overwrite unconditionally — including over the column DEFAULT, which is
  -- 'coordinator' and would otherwise mislabel every couple announcement.
  NEW.sender_role    := v_role;
  NEW.sender_user_id := v_uid;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_coordinator_broadcasts_derive_sender() IS
  'BEFORE INSERT on coordinator_broadcasts: for end-user sessions, replaces any '
  'client-supplied sender_role/sender_user_id — and the ''coordinator'' column '
  'DEFAULT — with values derived from auth.uid(). Service-role and owner '
  'sessions pass through untouched.';

DROP TRIGGER IF EXISTS coordinator_broadcasts_derive_sender ON public.coordinator_broadcasts;
CREATE TRIGGER coordinator_broadcasts_derive_sender
  BEFORE INSERT ON public.coordinator_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_coordinator_broadcasts_derive_sender();

-- ── 2 · TAKE THE PEN AWAY ──────────────────────────────────────────────────
-- The grant is table-wide, so it is dropped whole and re-issued per column.
-- Revoking INSERT (sender_role) against a table-level grant does NOT narrow
-- anything in Postgres — it warns and leaves the privilege standing.
REVOKE INSERT, UPDATE ON public.coordinator_broadcasts FROM authenticated;
REVOKE INSERT, UPDATE ON public.coordinator_broadcasts FROM anon;

-- anon gets nothing back: both INSERT policies are TO authenticated, so anon
-- could never insert a row regardless. This stops the ACL claiming otherwise.
GRANT INSERT (
  id,
  broadcast_id,
  event_id,
  body
) ON public.coordinator_broadcasts TO authenticated;

COMMENT ON COLUMN public.coordinator_broadcasts.sender_role IS
  'WHO the announcement is from, as shown to guests. Derived by '
  'tg_coordinator_broadcasts_derive_sender from auth.uid(); authenticated/anon '
  'hold no INSERT or UPDATE privilege on this column and cannot supply it. '
  'NOTE the column DEFAULT is ''coordinator'' — the trigger must overwrite it, '
  'or every couple announcement reads as the coordinator with no error.';

COMMENT ON COLUMN public.coordinator_broadcasts.sender_user_id IS
  'The announcing account. Derived from auth.uid() by '
  'tg_coordinator_broadcasts_derive_sender; not writable by authenticated/anon. '
  'Revoking THIS column is what keeps a missing trigger loud: nothing else '
  'fills it, and both INSERT policies require sender_user_id = auth.uid(), so '
  'the row is refused rather than landing under sender_role''s ''coordinator'' '
  'DEFAULT. Do not re-grant it without re-reading that migration header.';
