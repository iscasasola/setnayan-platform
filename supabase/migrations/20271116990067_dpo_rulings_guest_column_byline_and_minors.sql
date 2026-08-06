-- DPO rulings 03 and 04 — owner-decided 2026-08-06, as data protection officer.
--
-- Both concern `guest_columns`: a short written message a guest submits for the
-- couple's public event page. Zero rows exist in production, so both changes are
-- free to make today and impossible to make later — once a real name is on the
-- open web it cannot be taken back.
--
-- ── RULING 03 · the name is hidden unless the guest asks to be named ─────────
-- The question put to the DPO was whether a hidden byline should be the DEFAULT
-- or the opt-in. Ruling: DEFAULT. The byline is the guest's roster name, typed
-- by the COUPLE, not by the guest — so publishing it beside their words on the
-- open web is a disclosure the guest never made about themselves.
--
-- ⚠ THIS IS NOT A DEFAULT FLIP, AND READING IT AS ONE WOULD HAVE HIDDEN EVERY
-- MESSAGE. `author_publicly_hidden` sounds like a byline switch and is not: all
-- seven read paths filter `author_publicly_hidden = false`, so setting it
-- removes the WHOLE COLUMN from publication. Flipping its default would have
-- silently unpublished every guest message rather than anonymising it. The
-- product simply had no way to publish a message without a name.
--
-- So this adds that capability as its own column, and leaves the existing
-- suppression switch exactly as it is.
--
-- ── RULING 04 · a guest we already know to be a child may not author one ─────
-- Ruling: refuse it, using the signal we ALREADY hold — an active stewardship
-- marked `is_minor`, the same signal that already refuses a child's selfie for
-- face matching. Explicitly NOT by asking every guest their birthday: a guest
-- record holds no age at all today, and collecting ages in order to protect ages
-- would enlarge the very risk being managed.
--
-- The refusal is enforced by a TRIGGER on the table, not in the route and not
-- in the submit RPC — see the note above it for why. The route is one caller;
-- the table is every caller, including ones not written yet.

-- ── 03 ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.guest_columns
  ADD COLUMN IF NOT EXISTS author_named_publicly BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guest_columns.author_named_publicly IS
  'DPO ruling 2026-08-06: the guest OPTED IN to being named beside their published '
  'message. FALSE (the default) publishes the message with no byline. Distinct from '
  'author_publicly_hidden, which suppresses the entire column from publication.';

COMMENT ON COLUMN public.guest_columns.author_publicly_hidden IS
  'Suppresses the ENTIRE column from publication (every read path filters on it). '
  'NOT a byline switch — see author_named_publicly for that. The name misleads; it '
  'was read as a byline control in the 2026-07-30 filing draft.';

-- ── 04 ───────────────────────────────────────────────────────────────────────
-- A guest is a known child when the person behind their roster row holds an
-- active stewardship flagged is_minor. `guests.person_id` is the link;
-- `person_stewardships.branch_person_id` is the person.
CREATE OR REPLACE FUNCTION public.guest_is_known_minor(p_guest_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.guests g
      JOIN public.person_stewardships s
        ON s.branch_person_id = g.person_id
     WHERE g.guest_id = p_guest_id
       AND g.person_id IS NOT NULL
       AND s.is_minor
       AND s.status = 'active'
       AND s.deleted_at IS NULL
       AND s.revoked_at IS NULL
       AND s.relinquished_at IS NULL
       AND (s.ends_at IS NULL OR s.ends_at > NOW())
  );
$$;

COMMENT ON FUNCTION public.guest_is_known_minor(UUID) IS
  'DPO ruling 2026-08-06: TRUE when this guest is someone we ALREADY know to be a '
  'child (an active, unrevoked stewardship marked is_minor). Deliberately returns '
  'FALSE for an unknown age — we do not collect birthdays, and inventing certainty '
  'we do not have would be worse than the gap it closes.';

REVOKE ALL ON FUNCTION public.guest_is_known_minor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_is_known_minor(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.guest_is_known_minor(UUID) FROM authenticated;

-- ── The refusal itself ───────────────────────────────────────────────────────
-- A TRIGGER, not an edit to `guest_submit_column`. The RPC is ~100 lines and
-- copying it into this migration to insert four lines would fork it — the next
-- person to change the original would have two bodies to keep in step, and this
-- codebase has been bitten by exactly that. A trigger also closes writers that
-- do not exist yet: the RPC is today's only door, not necessarily tomorrow's.
--
-- 🔑 SCOPED TO `status = 'pending'`, WHICH IS THE SUBMIT/EDIT PATH. Withdrawal
-- writes 'user_deleted' and approval writes 'approved', so neither trips this.
-- That matters: a child who somehow already has a row must STILL be able to take
-- it down. A privacy rule that blocked its own takedown path would be the
-- opposite of the ruling.
CREATE OR REPLACE FUNCTION public.guest_columns_refuse_known_minor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pending' AND public.guest_is_known_minor(NEW.guest_id) THEN
    RAISE EXCEPTION 'gcol:minor';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_columns_refuse_known_minor ON public.guest_columns;
CREATE TRIGGER trg_guest_columns_refuse_known_minor
  BEFORE INSERT OR UPDATE ON public.guest_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.guest_columns_refuse_known_minor();

REVOKE ALL ON FUNCTION public.guest_columns_refuse_known_minor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_columns_refuse_known_minor() FROM anon;
REVOKE ALL ON FUNCTION public.guest_columns_refuse_known_minor() FROM authenticated;
