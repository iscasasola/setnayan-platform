-- march_own_groups
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (IF NOT EXISTS · CREATE OR REPLACE · DROP IF
-- EXISTS · the FK is added only when it is not there yet).
--
-- ⚖ OWNER 2026-10-29 (DECISION_LOG "GUESTS ANSWERS (owner ~14:40): custom
-- March groups YES"): *"yes. so if they have a custom way of marching they can
-- customize it."* — in Guests › March a couple can make their OWN march groups
-- (named, ordered, holding walks) beyond the role-based sections.
--
-- ── WHY A TABLE, AND NOT A FLAG ON SOMETHING THAT EXISTS (Rule 0) ──────────
-- What already exists, and what each can and cannot hold:
--   · `events.entourage_section_order` (TEXT[]) — the ORDER of the sections.
--     Deliberately not a closed list (its own COMMENT): it CAN carry an own
--     group's key in its place, and it does — no second order is invented.
--   · `events.role_names` (JSONB) — the couple's WORDS for the built-in
--     sections. It is printed on the invitation and sanitised against the known
--     section keys; a group that exists only in the march is not a word for one.
--   · `march_walks` — one row per person who walks. Which section a walker is
--     drawn in was always DERIVED from their role; nothing stored it.
-- So two facts have no home: that a group exists (with its name, and even with
-- nobody in it yet — a new group is empty until a name is dragged in), and who
-- walks in it. Hence:
--   1. `march_groups` — one row per own group: (event_id, group_key, label);
--   2. `march_walks.march_group` — the own group this walker walks in; NULL =
--      the section their role puts them in (every row today, so nothing moves).
--
-- 🔑 THE MARCH ONLY. What PRINTS is unchanged: the invitation's entourage still
-- prints everyone under their role (`orderedGroupKeys` drops an own key, and
-- `buildEntourage` reads `march_group` only in its march form). The same
-- posture as the couple's own sides ("The Groom & his parents"), which are
-- march-only too.
--
-- ⛔ guests' own data is never written by a march edit (the 2026-10-01 ruling,
-- `march-edits-touch-no-guest.db.test.ts`). Nothing here touches `guests`.

-- ── 1 · the groups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.march_groups (
  event_id    UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Never shown and never public: the key the section order and the walk rows
  -- name it by, minted by the maker (`own_` + 10 base-36 characters). The
  -- pattern keeps it apart from every built-in section key, so an own group can
  -- never be mistaken for one.
  group_key   TEXT        NOT NULL CHECK (group_key ~ '^own_[0-9a-z]{6,24}$'),
  -- The heading the couple gave it ("Flower Girls' Parade").
  label       TEXT        NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, group_key)
);

-- RLS AT CREATE TABLE.
ALTER TABLE public.march_groups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.march_groups IS
  'The couple''s OWN Wedding March groups (owner 2026-10-29: "if they have a custom way of marching they can '
  'customize it") — named sections beyond the role-based ones, drawn in the march only (never printed). Order: '
  'the key''s place in events.entourage_section_order. Members: march_walks.march_group. Written by the Event '
  'Hub draft''s Apply (guests/march-group-step.ts), read by loadMarch.';

-- Who may read and write it — exactly the hosts who arrange the march: `march_walks`' own terms, in the form they
-- read TODAY (20271281556823 rls_checks_once_per_query — each per-statement call asked once, never per row; held by
-- `policies-ask-once-per-query.db.test.ts`).
REVOKE ALL ON public.march_groups FROM PUBLIC;
REVOKE ALL ON public.march_groups FROM anon;
REVOKE ALL ON public.march_groups FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.march_groups TO authenticated;
GRANT ALL ON public.march_groups TO service_role;

DROP POLICY IF EXISTS march_groups_host_all ON public.march_groups;
CREATE POLICY march_groups_host_all ON public.march_groups
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
    OR event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level = 'edit')
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
    OR event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level = 'edit')
  );

DROP POLICY IF EXISTS march_groups_moderator_read ON public.march_groups;
CREATE POLICY march_groups_moderator_read ON public.march_groups
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('guest_list') l WHERE l.level IS NOT NULL));

CREATE OR REPLACE FUNCTION public.touch_march_groups()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS march_groups_touch ON public.march_groups;
CREATE TRIGGER march_groups_touch
  BEFORE UPDATE ON public.march_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_march_groups();

REVOKE ALL ON FUNCTION public.touch_march_groups() FROM PUBLIC, anon, authenticated;

-- ── 2 · who walks in one ──────────────────────────────────────────────────
ALTER TABLE public.march_walks ADD COLUMN IF NOT EXISTS march_group TEXT;

COMMENT ON COLUMN public.march_walks.march_group IS
  'The couple''s own march group this walker walks in (march_groups.group_key); NULL = the section their role '
  'puts them in. The march only — the invitation still prints them under their role. Written by set_march_group.';

-- A group that is deleted hands its walkers back to their role's section — the
-- walk ROW stays (their number); only the group is cleared.
-- 🔑 The column list on SET NULL (PostgreSQL 15+) is what makes a composite FK
-- safe here: a bare composite SET NULL would null event_id too (NOT NULL — so it
-- would behave like RESTRICT; see 20271226099791 for that trap).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'march_walks_march_group_fkey' AND conrelid = 'public.march_walks'::regclass
  ) THEN
    ALTER TABLE public.march_walks
      ADD CONSTRAINT march_walks_march_group_fkey
      FOREIGN KEY (event_id, march_group)
      REFERENCES public.march_groups (event_id, group_key)
      ON DELETE SET NULL (march_group);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS march_walks_event_group_idx
  ON public.march_walks (event_id, march_group)
  WHERE march_group IS NOT NULL;

-- ── 3 · the ONE writer of `march_walks.march_group` ───────────────────────
-- Into an own group (`p_group` = its key) or back to their role's section
-- (`p_group` NULL). The walker leaves whoever they walked with (their walk-mate
-- keeps the walk, alone) and takes a FRESH walk at the end of the march — so a
-- walk never spans two groups; the move that called this places them inside the
-- group right after (`set_entourage_order` / `join_entourage_line`, unchanged).
-- Someone in the "Not walking" tray is not moved (they walk first).
-- SECURITY INVOKER (the default): the caller's own RLS decides. Returns 1 when
-- the walker now walks in the group asked, 0 otherwise (a zero-row write is
-- success-shaped — the caller reads this, never assumes).
CREATE OR REPLACE FUNCTION public.set_march_group(
  p_event_id UUID,
  p_guest_id UUID,
  p_group    TEXT
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TEXT;
  v_has BOOLEAN;
  v_max INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE event_id = p_event_id AND guest_id = p_guest_id AND deleted_at IS NULL
  ) THEN
    RETURN 0;
  END IF;
  IF p_group IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.march_groups WHERE event_id = p_event_id AND group_key = p_group
  ) THEN
    RETURN 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.march_not_walking WHERE event_id = p_event_id AND guest_id = p_guest_id
  ) THEN
    RETURN 0;
  END IF;

  SELECT march_group, TRUE INTO v_now, v_has
  FROM public.march_walks
  WHERE event_id = p_event_id AND guest_id = p_guest_id
  FOR UPDATE;
  IF coalesce(v_has, FALSE) AND v_now IS NOT DISTINCT FROM p_group THEN
    RETURN 1;
  END IF;

  SELECT coalesce(max(walk_no), -1) INTO v_max
  FROM public.march_walks WHERE event_id = p_event_id;

  INSERT INTO public.march_walks (event_id, guest_id, walk_no, place_in_walk, march_group)
  VALUES (p_event_id, p_guest_id, v_max + 1, 0, p_group)
  ON CONFLICT (event_id, guest_id)
  DO UPDATE SET walk_no = EXCLUDED.walk_no, place_in_walk = 0, march_group = EXCLUDED.march_group;

  RETURN CASE WHEN EXISTS (
    SELECT 1 FROM public.march_walks
    WHERE event_id = p_event_id AND guest_id = p_guest_id AND march_group IS NOT DISTINCT FROM p_group
  ) THEN 1 ELSE 0 END;
END $$;

-- 🔒 REVOKE FROM PUBLIC FIRST — a new function is executable by PUBLIC by default.
REVOKE EXECUTE ON FUNCTION public.set_march_group(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_march_group(UUID, UUID, TEXT) TO authenticated;
