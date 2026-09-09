-- ════════════════════════════════════════════════════════════════════════════
-- THE TWO DOORS THE DATABASE LEFT OPEN
-- ════════════════════════════════════════════════════════════════════════════
--
-- Both were found by a 30-agent verification pass over the Story build (2026-09-10)
-- and then re-measured by hand against production before this file was written.
-- Both are the SAME SHAPE, the one this repo keeps paying for: the app refuses,
-- the database does not, and `authenticated` can reach the table directly over
-- PostgREST with the public anon key. "Our server action always sets it
-- correctly" is not a defence — the GRANT and the POLICY are the only controls.
--
-- ── DOOR 1 · A STORY COULD BE PUBLISHED WITHOUT ITS CONSENT TICK ────────────
-- Read out of prod: `authenticated` holds UPDATE on event_editorial.status AND
-- .publish_consent_at; policy `event_editorial_couple_rw` is PERMISSIVE FOR ALL
-- to the couple; the only triggers were the edition stamp and updated_at. So a
-- signed-in host could PATCH status='published' with no consent recorded, and
-- /[slug] renders on that column alone. The tick is the sentence that says the
-- story will carry their guests' words and faces — it is not decoration.
--
-- ── DOOR 2 · A WITHDRAWN MESSAGE COULD BE RE-APPROVED ───────────────────────
-- A guest withdrawing sets status='user_deleted' + user_deleted_at. Nothing
-- stopped a later UPDATE putting it back to 'approved', after which all three
-- public-read filters pass and the withdrawn words render again. photo_messages
-- had NO triggers at all; guest_columns had only the known-minor refusal.
--
-- ⛔ WHAT IS DELIBERATELY *NOT* ENFORCED HERE, AND WHY — READ BEFORE "FINISHING" IT
-- The desk's other rule is "publish is impossible while an item is undecided".
-- It is NOT added to this trigger. A HELD-BACK item (one whose tagged guest
-- opted out of photos) is un-acceptable BY DESIGN and keeps status='pending'
-- forever — the desk renders a lock chip and no control at all. A database rule
-- of "no pending rows may exist" would therefore make publishing PERMANENTLY
-- IMPOSSIBLE for any celebration holding one, with nothing on screen to say why.
-- That is a worse defect than the one it closes. The app keeps that rule; the
-- database keeps the half that can always be satisfied.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── DOOR 1 ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_publishing_needs_its_consent_tick()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Only the TRANSITION is guarded. A story already published stays published;
  -- this is not a continuous invariant, and making it one would strand every row
  -- that predates the consent column.
  /*
   * ⚠ ENFORCED AGAINST THE BROWSER-REACHABLE ROLES ONLY — and that is the whole
   * threat, not a softening. The hole is that `authenticated` holds UPDATE on
   * `status` and can PATCH it straight through PostgREST with the public anon
   * key. Server actions, admin paths and migrations run as the service role and
   * ALREADY set the tick; making them subject to this too breaks legitimate
   * restores and, measured, broke four shipped edition-stamping db tests that
   * seed a published row directly as setup.
   *
   * 🔑 THE ROLE TEST IS `current_user`, NOT `auth.role()`. The PGlite replay's
   * shim returns 'anon' where production returns NULL, so every
   * `auth.role() IS NULL` privileged branch is dead code in every db test in
   * this repo — a trap this corpus has already paid for once.
   *
   * ⚠ CONSEQUENCE FOR TESTS: the replay runs as superuser, so a test must
   * `SET ROLE authenticated` to exercise this at all. One does.
   */
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'published' AND COALESCE(OLD.status, '') <> 'published' THEN
    IF NEW.publish_consent_at IS NULL THEN
      RAISE EXCEPTION 'story:publish_needs_consent'
        USING HINT = 'A story cannot be published without the host''s consent tick.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_editorial_publish_needs_consent ON public.event_editorial;
CREATE TRIGGER event_editorial_publish_needs_consent
  BEFORE UPDATE ON public.event_editorial
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_publishing_needs_its_consent_tick();

COMMENT ON FUNCTION public.tg_publishing_needs_its_consent_tick() IS
  'Refuses a transition INTO published when publish_consent_at is NULL. The app already '
  'refuses it; authenticated holds UPDATE on both columns, so the app was not the fence. '
  'Deliberately does NOT require an empty desk: a held-back item stays pending forever by '
  'design, and that rule would make publishing permanently impossible for such an event.';

-- ── DOOR 2 ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_a_withdrawn_word_stays_withdrawn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- The guest's own act wins over the host's curation. Coming BACK from
  -- 'user_deleted' is the only transition refused; a host may still reject it,
  -- and the guest's own path (which sets user_deleted) is untouched.
  IF OLD.status = 'user_deleted' AND NEW.status = 'approved' THEN
    RAISE EXCEPTION 'story:withdrawn_stays_withdrawn'
      USING HINT = 'A guest withdrew these words; they cannot be approved back onto the story.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS photo_messages_withdrawn_stays_withdrawn ON public.photo_messages;
CREATE TRIGGER photo_messages_withdrawn_stays_withdrawn
  BEFORE UPDATE ON public.photo_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_a_withdrawn_word_stays_withdrawn();

DROP TRIGGER IF EXISTS guest_columns_withdrawn_stays_withdrawn ON public.guest_columns;
CREATE TRIGGER guest_columns_withdrawn_stays_withdrawn
  BEFORE UPDATE ON public.guest_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_a_withdrawn_word_stays_withdrawn();

COMMENT ON FUNCTION public.tg_a_withdrawn_word_stays_withdrawn() IS
  'A guest who withdrew a wish or a letter cannot have it approved back onto the published '
  'story. Both tables granted authenticated UPDATE on status with no trigger at all, so the '
  'withdrawal was enforced by the app only.';

COMMIT;
