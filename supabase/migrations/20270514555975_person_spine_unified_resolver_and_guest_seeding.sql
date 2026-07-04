-- person spine unified resolver and guest seeding
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine · Phase 1 · unified person resolution + guest seeding
-- (owner-locked 2026-07-04; "finish Phase 1 first" 2026-07-05).
--
-- ONE email-keyed resolver — public.resolve_or_claim_person() — that self-claim,
-- sign-up matching, and guest-seeding all route through: FIND a person by email
-- → CLAIM it if the caller is that account → else CREATE it. This is what makes
-- "your history was waiting" work: a new sign-up whose email was already seeded
-- as a guest CLAIMS that node instead of minting a duplicate. Email is the
-- strong identity anchor (implied consent); name-only guests are NOT auto-seeded
-- (weak signal → they wait for an explicit "is this you?" confirm, a later slice).
--
-- Adults-only, additive. Connections graph / life-stories / legacy (Phase 2/3)
-- are counsel-gated and NOT here.
-- ============================================================================

-- ── 1. One-person-per-email guarantee (dedup + race-safety). Verified 0 dups
--       in prod before adding. Replaces the slice-A non-unique email index.
DROP INDEX IF EXISTS public.people_email_lower_idx;
CREATE UNIQUE INDEX IF NOT EXISTS people_email_unique_idx
  ON public.people (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;

-- ── 2. The unified resolver. SECURITY DEFINER (search_path pinned) so it can
--       read/write public.people past its owner-only RLS while running inside
--       the users / guests trigger paths.
CREATE OR REPLACE FUNCTION public.resolve_or_claim_person(
  p_email        TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_first_name   TEXT DEFAULT NULL,
  p_last_name    TEXT DEFAULT NULL,
  p_phone        TEXT DEFAULT NULL,
  p_photo_url    TEXT DEFAULT NULL,
  p_birth_date   DATE DEFAULT NULL,
  p_claimer      UUID DEFAULT NULL,   -- account claiming this person (NULL = leave unclaimed)
  p_creator      UUID DEFAULT NULL    -- who created the node (host); only used on create
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT := lower(nullif(trim(p_email), ''));
  v_id      UUID;
  v_claimed UUID;
  v_display TEXT := coalesce(
                      nullif(trim(p_display_name), ''),
                      nullif(trim(concat_ws(' ', nullif(trim(p_first_name), ''),
                                                 nullif(trim(p_last_name), ''))), ''));
BEGIN
  -- No email AND no claimer → a name-only guest (weak signal). Do NOT auto-seed;
  -- signal "skip" to the caller so it leaves the link null until a confirm.
  IF v_email IS NULL AND p_claimer IS NULL THEN
    RETURN NULL;
  END IF;

  LOOP
    -- (a) Find by email (the dedup anchor).
    v_id := NULL;
    IF v_email IS NOT NULL THEN
      SELECT person_id, claimed_by_user_id INTO v_id, v_claimed
      FROM public.people
      WHERE lower(email) = v_email AND deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
      -- Found. If a claimer is present and the node is still unclaimed, CLAIM it
      -- ("your history was waiting") and fill any blank profile fields. The
      -- `claimed_by_user_id IS NULL` guard makes a concurrent double-claim a no-op.
      IF p_claimer IS NOT NULL AND v_claimed IS NULL THEN
        UPDATE public.people SET
          claimed_by_user_id = p_claimer,
          display_name       = coalesce(display_name, v_display),
          first_name         = coalesce(first_name, p_first_name),
          last_name          = coalesce(last_name, p_last_name),
          phone              = coalesce(phone, p_phone),
          profile_photo_url  = coalesce(profile_photo_url, p_photo_url),
          birth_date         = coalesce(birth_date, p_birth_date)
        WHERE person_id = v_id AND claimed_by_user_id IS NULL;
      END IF;
      RETURN v_id;
    END IF;

    -- (b) Not found → create. Race-safe: a concurrent create of the same email
    -- raises unique_violation; catch it and loop back to the find branch.
    BEGIN
      INSERT INTO public.people (
        claimed_by_user_id, created_by_user_id,
        display_name, first_name, last_name, email, phone, profile_photo_url, birth_date
      ) VALUES (
        p_claimer, coalesce(p_creator, p_claimer),
        v_display, p_first_name, p_last_name, v_email, p_phone, p_photo_url, p_birth_date
      )
      RETURNING person_id INTO v_id;
      RETURN v_id;
    EXCEPTION WHEN unique_violation THEN
      -- another txn created this email first — retry the SELECT.
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.resolve_or_claim_person(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,UUID,UUID) IS
  'Person-spine identity resolver: find a person by email, claim it for p_claimer if unclaimed, else create. Email-keyed dedup; name-only (no email, no claimer) returns NULL (needs an explicit confirm). Used by self-claim (users trigger), sign-up matching, and guest seeding.';

-- ── 3. Refine self-claim to route through the resolver (supersedes the naive
--       always-insert from 20270513691781). A new sign-up whose email was
--       already seeded as a guest now CLAIMS that node instead of failing the
--       unique-email index.
CREATE OR REPLACE FUNCTION public.ensure_person_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.resolve_or_claim_person(
    p_email        => NEW.email,
    p_display_name => NEW.display_name,
    p_phone        => NEW.phone,
    p_photo_url    => NEW.profile_photo_url,
    p_birth_date   => NEW.birth_date,
    p_claimer      => NEW.user_id,
    p_creator      => NEW.user_id
  );
  RETURN NEW;
END;
$$;

-- ── 4. guests.person_id — links a guest row to its durable person node.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.people(person_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS guests_person_id_idx
  ON public.guests (person_id) WHERE person_id IS NOT NULL;

-- ── 5. Auto-resolve person_id on guest insert / email change (email guests only;
--       name-only guests stay unlinked). BEFORE row trigger sets NEW.person_id.
CREATE OR REPLACE FUNCTION public.set_guest_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
BEGIN
  IF nullif(trim(NEW.email), '') IS NULL THEN
    RETURN NEW;  -- name-only guest — leave unlinked (needs a confirm)
  END IF;
  -- The event's couple/host is the node creator, so they can see it under RLS.
  SELECT em.user_id INTO v_host
  FROM public.event_members em
  WHERE em.event_id = NEW.event_id AND em.member_type = 'couple'
  ORDER BY em.user_id
  LIMIT 1;
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
END;
$$;

DROP TRIGGER IF EXISTS set_guest_person ON public.guests;
CREATE TRIGGER set_guest_person
  BEFORE INSERT OR UPDATE OF email ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.set_guest_person();

-- ── 6. Backfill existing email-having, non-deleted guests that aren't linked.
--       resolve_or_claim_person dedupes by email; the unique index guarantees
--       one node per email even across rows. Idempotent (only touches NULLs).
UPDATE public.guests g SET person_id = public.resolve_or_claim_person(
  p_email        => g.email,
  p_display_name => g.display_name,
  p_first_name   => g.first_name,
  p_last_name    => g.last_name,
  p_phone        => g.mobile,
  p_photo_url    => g.profile_photo_url,
  p_creator      => (
    SELECT em.user_id FROM public.event_members em
    WHERE em.event_id = g.event_id AND em.member_type = 'couple'
    ORDER BY em.user_id LIMIT 1
  )
)
WHERE g.person_id IS NULL
  AND nullif(trim(g.email), '') IS NOT NULL
  AND g.deleted_at IS NULL;
