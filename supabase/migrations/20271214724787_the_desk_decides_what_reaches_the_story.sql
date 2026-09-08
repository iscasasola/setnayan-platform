-- the_desk_decides_what_reaches_the_story
--
-- 08 step 1.2 · "The desk" — ONE queue where the host decides what reaches
-- their story. THE RULE THE DESK IS BUILT ON: *accept is the only way anything
-- enters.* Nothing enters without it.
--
-- ═══ WHY THIS MIGRATION EXISTS AT ALL ═══════════════════════════════════════
-- `03_Data_Requirements.md` § Bonus and the session brief both state that the
-- desk's four sources each carry "its own status column" and that "nothing new
-- is stored". **MEASURED AGAINST PRODUCTION 2026-09-09, THAT IS FALSE FOR TWO
-- OF THE FOUR**, and the two failures point in opposite directions:
--
--   · `photo_messages`  — status TEXT pending|approved|rejected|user_deleted  ✅
--   · `guest_columns`   — status TEXT pending|approved|rejected|user_deleted  ✅
--   · `papic_mission_completions` — NO status, NO moderation_state, NO hidden
--     flag. Nothing on the row can express a host decision. The public story
--     shows a challenge answer as soon as the GUEST's own consents pass
--     (`consent_to_share` + the joined capture's screening) — **the host is
--     never asked at all.**
--   · `editorial_vendor_media` — no status either. It has `hidden_by_couple`,
--     `DEFAULT FALSE`: **shown unless hidden**, the exact inverse of what the
--     desk promises ("nothing a supplier sends appears until you accept it").
--     It is also a GATE WITH NO HANDLE — `lib/editorial-vendor-media.ts`
--     records it (three readers, zero writers, measured 2026-09-04) and
--     `gates-have-handles.baseline.txt` carries the line. This migration does
--     NOT write it; that finding stays true and the baseline line stays earned.
--
-- Both new columns are born `'pending'`, so both sources move from "published
-- unless stopped" to "published only if chosen". The change can only ever show
-- LESS — the monotone principle the whole consent design rests on.
--
-- 🔢 SAFE BY ARITHMETIC AT THE MERGE, read out of prod BY THE OBJECT, not
-- assumed: all four source tables hold **0 rows**. Nobody's published story
-- changes today, and the first row of either kind is born under the new rule.
--
-- ═══ THE GRANTS ARE THE LOAD-BEARING HALF, AND A TABLE-LEVEL AUDIT LIES ══════
-- 🪤 THIS WAS MEASURED WRONG FIRST AND THE DRY-RUN CAUGHT IT. Reading
-- `information_schema.role_table_grants` says `authenticated` holds **no UPDATE**
-- on `editorial_vendor_media`, which reads as "that table is closed and its
-- couple UPDATE policy is inert". **IT IS NOT.** The grant is held
-- PER COLUMN — on all 14 of them, `still_r2_key`, `caption`,
-- `vendor_profile_id` and `event_id` included — so a table-level audit reads
-- the table as closed while it is open. Same shape as the Papic INSERT hole of
-- 2026-08: `has_table_privilege(...,'INSERT')` answered FALSE while the grant
-- sat on all 39 columns.
--
--   · `papic_mission_completions`: `authenticated` holds UPDATE on all 8
--     columns, and **no UPDATE policy admits a couple at all** — so the grant is
--     inert today, in the other direction.
--
-- Both are therefore handled at COLUMN level, never table level:
--   · the mission table's UPDATE is REVOKED AT TABLE LEVEL FIRST (that is what
--     drops column grants — revoking column-by-column leaves the NEXT column
--     granted) and re-granted on `status` ALONE. 8 columns → 1. Without this,
--     giving the host a policy would also hand them `consent_to_share` — **the
--     GUEST's own RA 10173 opt-in** — and `capture_id`. THE ROW IS YOURS, THE
--     FIELD IS NOT.
--   · the vendor table gets `GRANT UPDATE (status)` so the desk's own write
--     works.
--
-- ⛔ THE 14 PRE-EXISTING COLUMN GRANTS ON `editorial_vendor_media` ARE **NOT**
-- NARROWED HERE, AND THAT IS A DELIBERATE REFUSAL, NOT AN OVERSIGHT. They are a
-- real, live over-grant: paired with `editorial_vendor_media_couple_update`, a
-- couple can today PATCH a supplier's `still_r2_key` (swap the photograph),
-- their `caption`, and even `vendor_profile_id` (reassign the submission to a
-- different shop) through PostgREST. It predates this work, it is NOT caused by
-- it, and narrowing a live grant is its own change with its own blast radius —
-- the vendor submit path writes through the admin client and would probably
-- survive, but "probably" is not a measurement. **Named loudly rather than
-- swept, and it does not weaken the desk:** the public reader requires
-- `status = 'approved'` AND `NOT hidden_by_couple`, and `status` is the column
-- this migration governs.
--
-- ⚠ `editorial_vendor_media.moderation_state` is separately pinned by
-- `tg_pin_moderation_state` against `authenticated`/`anon`, so a host can never
-- move the SCREEN. That stays true and is untouched: the host decides
-- CURATION, the screen decides SAFETY.
--
-- ═══ WHO MAY DECIDE ═════════════════════════════════════════════════════════
-- Exactly the authority the story editor ALREADY proves — `hostUserId()` in
-- `app/dashboard/[eventId]/story/actions.ts`: the `couple` member, OR an
-- ACCEPTED, not-removed `event_moderators` row. The predicate below is the
-- database's copy of that same rule, mirroring `event_editorial`'s own pair
-- (`event_editorial_couple_rw` + `event_editorial_moderator_rw`) — the table
-- this desk publishes into. One authority, two enforcements, no third opinion.

-- ─── 1 · papic_mission_completions — a challenge answer the host chose ───────

ALTER TABLE public.papic_mission_completions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.papic_mission_completions'::regclass
      AND conname = 'papic_mission_completions_status_check'
  ) THEN
    ALTER TABLE public.papic_mission_completions
      ADD CONSTRAINT papic_mission_completions_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

COMMENT ON COLUMN public.papic_mission_completions.status IS
  'The HOST''s decision on this answer, made at the desk '
  '(/dashboard/[eventId]/story). ''pending'' until they choose — accept is the '
  'only way it reaches the story, and the public reader requires ''approved''. '
  'Independent of consent_to_share, which is the GUEST''s own opt-in: both must '
  'say yes and neither substitutes for the other. No ''user_deleted'' value '
  '(the two text sources have one) because a guest withdraws by clearing '
  'consent_to_share, which already withholds the row on its own.';

CREATE INDEX IF NOT EXISTS papic_mission_completions_desk_idx
  ON public.papic_mission_completions (event_id, status, created_at DESC);

-- TABLE level first — that is what drops the 8 column grants.
REVOKE UPDATE ON TABLE public.papic_mission_completions FROM authenticated;
GRANT UPDATE (status) ON TABLE public.papic_mission_completions TO authenticated;

DROP POLICY IF EXISTS papic_mission_completions_host_decides
  ON public.papic_mission_completions;
CREATE POLICY papic_mission_completions_host_decides
  ON public.papic_mission_completions FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  );

-- ─── 2 · A HELD-BACK CAPTURE CANNOT BE ACCEPTED BY ANY ROUTE ─────────────────
-- The acceptance criterion is "…by any route INCLUDING A HAND-MADE REQUEST", so
-- the app-side check in the desk's server action is NOT enough on its own: the
-- host holds `UPDATE (status)` and can PATCH `/rest/v1/papic_mission_completions`
-- with the public anon key and their own session. That is the same shape as the
-- eight advisory gates found on `recordSeatCapture` in 2026-08 — the refusals
-- lived in the app while the row went in through the caller's session.
--
-- So the refusal lives in the DATABASE, and it is a TRIGGER rather than a CHECK
-- because every fact it needs is on another table (a CHECK may not query one).
--
-- ⚖ IT MIRRORS `consent-veto.ts` `publicKeyForCapture` AND IS MONOTONE THE SAME
-- WAY — it can only ever refuse more, never permit more:
--   · no capture on the row      → refuse (an answer with nothing to show)
--   · capture missing            → refuse (veto unresolved ⇒ withhold everything)
--   · hidden, unscreened, or the
--     guest's own consent absent → refuse
--   · ANY un-removed photo_tag naming a guest whose photo_consent is FALSE
--                                → refuse. **A capture's veto beats the host's
--     curation.** `photo_tags.source_table` genuinely carries
--     'papic_guest_captures' as well as 'papic_photos' (CHECK constraint read
--     out of prod), so the veto reaches this source.
--   · `removed_at IS NOT NULL` tags do NOT veto — a withdrawn tag is not a
--     standing objection.
--
-- ⛔ IT REFUSES ONLY THE TRANSITION TO 'approved'. Rejecting, un-deciding, and
-- every write that leaves status alone stay possible, so a veto arriving later
-- can never strand a row in a state the host cannot leave.

CREATE OR REPLACE FUNCTION public.tg_refuse_accepting_a_held_back_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW; -- already accepted; this write is not the transition
  END IF;

  IF NEW.capture_id IS NULL THEN
    RAISE EXCEPTION 'desk:no_capture'
      USING HINT = 'A challenge answer with no capture has nothing to show.';
  END IF;

  -- 🪤 `col = TRUE` / `col = FALSE` ARE DELIBERATELY NOT WRITTEN HERE, and this
  -- is the second migration in this repo to pay for it. `gates-have-handles`
  -- scans every function body with `\mcol\M\s*=[^=]` to find who WRITES a
  -- column — and a COMPARISON matches that shape exactly as an assignment does.
  -- Writing `c.consent_to_public = TRUE` made this function look like a writer
  -- of `consent_to_public`, which retired a baseline line recording something
  -- still TRUE about a different table's copy of that column (`papic_photos`),
  -- and the guard failed with a message naming a table this migration never
  -- touches. Both columns below are NOT NULL, so the bare-boolean form is
  -- exactly equivalent — no three-valued logic changes hands.
  SELECT TRUE INTO v_ok
  FROM public.papic_guest_captures c
  WHERE c.capture_id = NEW.capture_id
    AND c.hidden_at IS NULL
    AND c.consent_to_public
    AND c.moderation_state = 'clean'
    AND NOT EXISTS (
      SELECT 1
      FROM public.photo_tags t
      JOIN public.guests g ON g.guest_id = t.guest_id
      WHERE t.source_table = 'papic_guest_captures'
        AND t.source_id = c.capture_id
        AND t.removed_at IS NULL
        AND NOT g.photo_consent
        AND g.deleted_at IS NULL
    );

  IF v_ok IS NULL THEN
    RAISE EXCEPTION 'desk:held_back'
      USING HINT =
        'This one is already held back — it is unscreened, withdrawn, or it '
        'shows a guest who opted out of photos. A capture''s veto beats the '
        'host''s curation, so it cannot be accepted.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papic_mission_completions_refuse_held_back
  ON public.papic_mission_completions;
CREATE TRIGGER papic_mission_completions_refuse_held_back
  BEFORE INSERT OR UPDATE ON public.papic_mission_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_refuse_accepting_a_held_back_answer();

-- ─── 3 · editorial_vendor_media — a supplier's frame the host chose ──────────

ALTER TABLE public.editorial_vendor_media
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.editorial_vendor_media'::regclass
      AND conname = 'editorial_vendor_media_status_check'
  ) THEN
    ALTER TABLE public.editorial_vendor_media
      ADD CONSTRAINT editorial_vendor_media_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- The screen still outranks the host here too — and this one CAN be a CHECK,
  -- because both columns sit on the same row. It is deliberately the same shape
  -- as `photo_messages.approved_needs_screen` and `gcol_approved_needs_screen`,
  -- so all four desk sources refuse an unscreened acceptance the same way.
  -- ⚠ Stricter than its two siblings on purpose: they permit 'flagged' (a human
  -- looks), this permits ONLY 'clean'. Third-party media is held until the NSFW
  -- screen settles — which is exactly what the shipped public reader already
  -- does (`.eq('moderation_state','clean')`), so this makes the page's existing
  -- behaviour a rule instead of a habit.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.editorial_vendor_media'::regclass
      AND conname = 'evm_approved_needs_screen'
  ) THEN
    ALTER TABLE public.editorial_vendor_media
      ADD CONSTRAINT evm_approved_needs_screen
      CHECK (status <> 'approved' OR moderation_state = 'clean');
  END IF;
END $$;

COMMENT ON COLUMN public.editorial_vendor_media.status IS
  'The HOST''s decision on this submission, made at the desk '
  '(/dashboard/[eventId]/story). ''pending'' until they choose. Before this '
  'column the only lever was hidden_by_couple, which is DEFAULT FALSE — shown '
  'unless hidden — and which has never had a writer; the desk''s promise is the '
  'inverse, so the decision needed a column whose SAFE value is its DEFAULT. '
  'hidden_by_couple is deliberately left alone and unwritten: it stays a real '
  'recorded finding, and the public reader now requires BOTH '
  '(status = ''approved'' AND NOT hidden_by_couple) — belt and braces, so losing '
  'one still leaves the other. Turning a supplier''s note down never withdraws '
  'their CREDIT, which is free and stays either way.';

CREATE INDEX IF NOT EXISTS editorial_vendor_media_desk_idx
  ON public.editorial_vendor_media (event_id, status, created_at DESC);

GRANT UPDATE (status) ON TABLE public.editorial_vendor_media TO authenticated;

-- A SECOND, precisely-scoped UPDATE policy rather than a widening of
-- `editorial_vendor_media_couple_update`: that one governs the couple's lane
-- over the whole row and keeps doing so, untouched. This one exists to admit the
-- accepted MODERATOR the story editor already treats as a host — the couple-only
-- `current_couple_event_ids()` shape would otherwise refuse them HERE and
-- nowhere else on the desk, silently, which is how a gate wrong in this
-- direction stays invisible. Permissive policies are OR'd.
DROP POLICY IF EXISTS editorial_vendor_media_host_decides
  ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_host_decides
  ON public.editorial_vendor_media FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  );

-- ─── 4 · Prove the shape rather than trusting this file ──────────────────────
-- A migration comment is not evidence — this repo carries six applied
-- migrations whose headers state something false. These raise instead.
--
-- 🪤 THE FIRST VERSION OF THIS BLOCK WAS DECORATION. It asserted over
-- `role_table_grants`, which is blind to per-column grants — so it would have
-- passed while `authenticated` held UPDATE on all 14 columns of
-- `editorial_vendor_media`. It reads `column_privileges` now, which is the view
-- that can actually see the thing being claimed.

DO $$
DECLARE
  v_status_grants INT;
  v_mission_other INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'papic_mission_completions'
      AND column_name = 'status'
      AND is_nullable = 'NO' AND column_default = '''pending''::text'
  ) THEN
    RAISE EXCEPTION
      'papic_mission_completions.status must be NOT NULL DEFAULT ''pending'' — '
      'the safe value has to be the default, or a row written before the desk '
      'existed would publish itself unchosen';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'editorial_vendor_media'
      AND column_name = 'status'
      AND is_nullable = 'NO' AND column_default = '''pending''::text'
  ) THEN
    RAISE EXCEPTION
      'editorial_vendor_media.status must be NOT NULL DEFAULT ''pending'' — a '
      'supplier submission that defaults to shown is the opt-out model this '
      'column exists to replace';
  END IF;

  -- The desk's own write must be possible on BOTH sources, or its refusal is an
  -- ABSENCE rather than an error and the button silently does nothing.
  SELECT count(*) INTO v_status_grants
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE' AND column_name = 'status'
    AND table_name IN ('papic_mission_completions', 'editorial_vendor_media');
  IF v_status_grants <> 2 THEN
    RAISE EXCEPTION
      'the per-column UPDATE grant on status is missing on % of the two desk '
      'sources — a host decision there would fail as an absence, not an error',
      2 - v_status_grants;
  END IF;

  -- …and on the mission table the host must hold `status` AND NOTHING ELSE.
  -- consent_to_share is the GUEST's own RA 10173 opt-in; a host who can write it
  -- can consent on somebody else's behalf.
  SELECT count(*) INTO v_mission_other
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE' AND table_name = 'papic_mission_completions'
    AND column_name <> 'status';
  IF v_mission_other <> 0 THEN
    RAISE EXCEPTION
      'authenticated can still UPDATE % non-status column(s) on '
      'papic_mission_completions — consent_to_share is among them, and a host '
      'must never be able to answer a guest''s consent for them',
      v_mission_other;
  END IF;
END $$;
