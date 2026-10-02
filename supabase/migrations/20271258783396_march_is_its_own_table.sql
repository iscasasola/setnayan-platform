-- march_is_its_own_table
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (IF NOT EXISTS · CREATE OR REPLACE · DROP IF
-- EXISTS · the one-time copy runs only for an event with no march rows yet).
--
-- ⚖ OWNER 2026-10-01 (DECISION_LOG "THE WEDDING MARCH IS ITS OWN ENTITY"):
-- *"wedding march is a different entity."* And "A WALK AND A COUPLE ARE
-- INDEPENDENT": the march sets ONLY who walks together and in what order; it
-- never sets or shows whether two people are a couple.
--
-- Until now the march rode on the guest row: `guests.pair_with_guest_id`
-- (who walks beside whom, mutual), `guests.entourage_order` (the line's place)
-- and `guests.couple_with_guest_id` (the march's "They're a couple" tick). So a
-- march edit WROTE GUESTS — exactly the coupling the owner ruled out.
--
-- ── THE SHAPE THE OWNER APPROVED: ONE ROW PER PERSON IN THE MARCH ─────────
--   (event_id, guest_id UNIQUE per event, walk_no, place_in_walk)
--   · a WALK is the rows sharing a walk_no — one, two (or more) people;
--   · ORDER is walk_no ascending — reorder = renumber;
--   · ALONE is being the only row in your walk;
--   · a guest deleted for real takes their row with them (CASCADE).
-- The owner asked "that is the most efficient design already?" and this single
-- table was chosen over walks + members (2026-10-01).
--
-- 🔑 walk_no IS UNIQUE PER WALK ACROSS THE WHOLE EVENT, not per section. Two
-- sections may not both have a walk 0: two rows sharing a number ARE one walk,
-- so a per-section count would make a ninong and a flower girl "walk
-- together". A section prints its walks in walk_no order; the numbers between
-- belong to other sections, which is harmless.
--
-- 🔑 A GUEST WITH NO ROW is an entourage member nobody has placed yet (added
-- after this migration). They print alone, after the placed walks of their
-- section, in the role-then-surname default — the same rule an unplaced line
-- always had. The first move in that section places them (`set_entourage_order`).
--
-- ⛔ guests' own data (+1, partner link, role, side) is NEVER written by a march
-- edit, and a guest edit never writes the march. Every function below writes
-- `march_walks` and nothing else — `march-edits-touch-no-guest.db.test.ts`
-- holds that.

-- ── 1 · what the composite FK points at ───────────────────────────────────
-- `guest_id` is the guests PK, so (event_id, guest_id) is unique already; the
-- index makes it REFERENCEABLE, so the FK below can say "a guest OF THIS EVENT"
-- instead of trusting every writer to check. Unlike `pair_with_guest_id`'s
-- single-column SET NULL (see 20271226099791 for why a composite SET NULL is
-- refused), a composite CASCADE is safe: it deletes the march row, it never
-- tries to null event_id.
CREATE UNIQUE INDEX IF NOT EXISTS guests_event_guest_key
  ON public.guests (event_id, guest_id);

-- ── 2 · the march ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.march_walks (
  event_id       UUID     NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id       UUID     NOT NULL,
  -- The walk this person is in, and its place in the march (ascending).
  walk_no        INTEGER  NOT NULL CHECK (walk_no >= 0),
  -- Their place inside the walk — who is named first when the section has no
  -- left/right columns to say it (two candle sponsors hold the same role).
  place_in_walk  SMALLINT NOT NULL DEFAULT 0 CHECK (place_in_walk >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per person per event: a person walks in exactly one walk.
  PRIMARY KEY (event_id, guest_id),
  CONSTRAINT march_walks_guest_fkey
    FOREIGN KEY (event_id, guest_id)
    REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

-- Every reader asks for one event's march in walk order.
CREATE INDEX IF NOT EXISTS march_walks_event_walk_idx
  ON public.march_walks (event_id, walk_no, place_in_walk);

-- RLS AT CREATE TABLE.
ALTER TABLE public.march_walks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.march_walks IS
  'The Wedding March — its own entity (owner 2026-10-01). One row per person who walks: '
  'a walk = the rows sharing walk_no (unique per walk across the event); order = walk_no '
  'ascending; place_in_walk orders a walk''s people. Says nothing about being a couple. '
  'Written only by join_entourage_line · swap_entourage_places · set_entourage_order · '
  'unpair_guest. Read through guests (the composite FK) by lib/entourage.ts.';

-- ── 3 · who may read and write it — the hosts, as on `guests` ─────────────
-- ⚠ `current_couple_event_ids()`, NOT `current_event_ids()`. The latter returns
-- an event for an ordinary invited GUEST too (its own COMMENT says a host policy
-- must not use it — ten were corrected on 2026-07-27, migration
-- 20271015300000). The march is the hosts' to arrange; the public invitation
-- reads it with the service role, exactly as it reads `guests`.
--
-- The guest-list moderator terms mirror `guests`' own policies, so everybody who
-- could pair two people when the march lived on `guests` still can, and a
-- view-only coordinator still SEES the march instead of a march that silently
-- fell apart into singles.
REVOKE ALL ON public.march_walks FROM PUBLIC;
REVOKE ALL ON public.march_walks FROM anon;
REVOKE ALL ON public.march_walks FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.march_walks TO authenticated;
GRANT ALL ON public.march_walks TO service_role;

DROP POLICY IF EXISTS march_walks_host_all ON public.march_walks;
CREATE POLICY march_walks_host_all ON public.march_walks
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
    OR public.moderator_area_level(event_id, 'guest_list') = 'edit'
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
    OR public.moderator_area_level(event_id, 'guest_list') = 'edit'
  );

DROP POLICY IF EXISTS march_walks_moderator_read ON public.march_walks;
CREATE POLICY march_walks_moderator_read ON public.march_walks
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'guest_list') IS NOT NULL);

CREATE OR REPLACE FUNCTION public.touch_march_walks()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS march_walks_touch ON public.march_walks;
CREATE TRIGGER march_walks_touch
  BEFORE UPDATE ON public.march_walks
  FOR EACH ROW EXECUTE FUNCTION public.touch_march_walks();

REVOKE ALL ON FUNCTION public.touch_march_walks() FROM PUBLIC, anon, authenticated;

-- ── 4 · the one-time copy: what the guest rows already said ───────────────
-- Every MUTUAL `pair_with_guest_id` pair → one walk of two; every other
-- entourage member → a walk of one. Numbered so each section prints EXACTLY
-- what it printed the moment before this ran (lib/entourage.ts `orderLines`):
--   1. hand-placed lines first, by `entourage_order` (a pair's number is its
--      lead's, else its partner's — `placedAt`);
--   2. then the rest by the section's role order (`spec.roles`; this list is
--      `ENTOURAGE_ROLES` — every section's roles in printing order — so a
--      section's own order is preserved inside it), then surname, then first
--      name, then id.
-- A pair's lead (place 0) is its earlier role — the left column in every
-- section that has columns (Ninong before Ninang, Maid before Best Man,
-- Bridesmaid before Groomsman).
--
-- A removed (soft-deleted) guest is not copied: their partner already printed
-- alone. A dangling, one-way pointer is not a pair and is not copied as one.
--
-- ⚠ This role list is a SNAPSHOT for a one-time copy, not a second registry —
-- nothing reads it after this statement. lib/entourage.ts stays the one rule.
WITH role_pos(role, pos) AS (
  SELECT r, (o - 1)::int
  FROM unnest(ARRAY[
    'groom_parents', 'bride_parents', 'groom_immediate_family', 'bride_immediate_family',
    'maid_of_honor', 'matron_of_honor', 'best_man', 'best_woman',
    'principal_sponsor', 'principal_sponsor_ninong', 'principal_sponsor_ninang',
    'candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor',
    'bridesmaid', 'groomsman',
    'ring_bearer', 'bible_bearer', 'coin_bearer',
    'flower_girl',
    'officiant', 'reader_lector', 'soloist_musician',
    'wali', 'witness', 'imam', 'wakil'
  ]) WITH ORDINALITY AS t(r, o)
),
live AS (
  SELECT g.event_id, g.guest_id, g.pair_with_guest_id, g.entourage_order,
         lower(coalesce(nullif(btrim(g.last_name), ''), btrim(g.display_name), '')) AS k_last,
         lower(coalesce(btrim(g.first_name), '')) AS k_first,
         (SELECT min(rp.pos) FROM role_pos rp
           WHERE rp.role = g.role::text
              OR rp.role = ANY (coalesce(g.extra_roles::text[], '{}'::text[]))) AS pos
  FROM public.guests g
  WHERE g.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.march_walks mw WHERE mw.event_id = g.event_id)
),
paired AS (
  SELECT a.guest_id, b.guest_id AS partner_id
  FROM live a
  JOIN live b
    ON b.event_id = a.event_id
   AND b.guest_id = a.pair_with_guest_id
   AND b.pair_with_guest_id = a.guest_id
   AND b.guest_id <> a.guest_id
),
walkers AS (
  SELECT l.event_id, l.guest_id, l.pos, l.k_last, l.k_first, l.entourage_order,
         CASE WHEN p.partner_id IS NULL THEN l.guest_id::text
              ELSE least(l.guest_id::text, p.partner_id::text) END AS line_key
  FROM live l
  LEFT JOIN paired p ON p.guest_id = l.guest_id
  WHERE l.pos IS NOT NULL OR p.partner_id IS NOT NULL
),
placed_in_line AS (
  SELECT w.*,
         (row_number() OVER (PARTITION BY w.event_id, w.line_key
                             ORDER BY w.pos NULLS LAST, w.k_last, w.k_first, w.guest_id) - 1)::int AS place
  FROM walkers w
),
lines AS (
  SELECT event_id, line_key,
         (array_agg(entourage_order ORDER BY place) FILTER (WHERE entourage_order IS NOT NULL))[1] AS placed,
         max(pos)     FILTER (WHERE place = 0) AS l_pos,
         max(k_last)  FILTER (WHERE place = 0) AS l_last,
         max(k_first) FILTER (WHERE place = 0) AS l_first,
         max(guest_id::text) FILTER (WHERE place = 0) AS l_id
  FROM placed_in_line
  GROUP BY event_id, line_key
),
numbered AS (
  SELECT event_id, line_key,
         (row_number() OVER (PARTITION BY event_id
                             ORDER BY placed NULLS LAST, l_pos NULLS LAST, l_last, l_first, l_id) - 1)::int AS walk_no
  FROM lines
)
INSERT INTO public.march_walks (event_id, guest_id, walk_no, place_in_walk)
SELECT p.event_id, p.guest_id, n.walk_no, p.place
FROM placed_in_line p
JOIN numbered n USING (event_id, line_key)
ON CONFLICT (event_id, guest_id) DO NOTHING;

-- ── 5 · the moves, now on the march ───────────────────────────────────────
-- Same names and signatures as before, so `march-actions.ts` /
-- `entourage-write.ts` / `pair-actions.ts` keep calling what they called; each
-- now writes `march_walks` ONLY. SECURITY INVOKER (the default): the caller's
-- own RLS on `march_walks` decides — these add atomicity, never reach.
-- WHICH moves are allowed is still `lib/march-moves.ts`, asked against a fresh
-- read before any of these is called.

-- join · the joiner walks in the anchor's walk.
CREATE OR REPLACE FUNCTION public.join_entourage_line(
  p_event_id UUID,
  p_anchor   UUID,
  p_joiner   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_found  INT;
  v_walk   INT;
  v_joined INT;
  v_place  INT;
BEGIN
  IF p_anchor = p_joiner THEN
    RAISE EXCEPTION 'A guest cannot walk with themselves';
  END IF;

  SELECT count(*) INTO v_found
  FROM public.guests
  WHERE event_id = p_event_id AND guest_id IN (p_anchor, p_joiner) AND deleted_at IS NULL;
  IF v_found <> 2 THEN
    RAISE EXCEPTION 'Both guests must belong to this event';
  END IF;

  SELECT walk_no INTO v_walk
  FROM public.march_walks
  WHERE event_id = p_event_id AND guest_id = p_anchor
  FOR UPDATE;
  IF NOT FOUND THEN
    -- The action places the section first (`pinLineOrder`); arriving here
    -- unplaced is a caller bug, and guessing a number would pin a line nobody
    -- dropped there.
    RAISE EXCEPTION 'This walk has no place in the march yet';
  END IF;

  SELECT walk_no INTO v_joined
  FROM public.march_walks
  WHERE event_id = p_event_id AND guest_id = p_joiner
  FOR UPDATE;
  IF v_joined = v_walk THEN
    RETURN; -- already walking together: nothing to do
  END IF;

  -- Whoever else walked with the anchor steps out — into a walk of their own,
  -- RIGHT BEHIND this one, never to the end of the march. Everything later
  -- moves back one to make the room. The joiner's old walk-mates keep their
  -- own walk and place, walking alone.
  IF EXISTS (
    SELECT 1 FROM public.march_walks
    WHERE event_id = p_event_id AND walk_no = v_walk AND guest_id <> p_anchor
  ) THEN
    UPDATE public.march_walks
       SET walk_no = walk_no + 1
     WHERE event_id = p_event_id AND walk_no > v_walk;
    UPDATE public.march_walks
       SET walk_no = v_walk + 1
     WHERE event_id = p_event_id AND walk_no = v_walk AND guest_id <> p_anchor;
  END IF;

  SELECT coalesce(max(place_in_walk), 0) + 1 INTO v_place
  FROM public.march_walks
  WHERE event_id = p_event_id AND walk_no = v_walk AND guest_id <> p_joiner;

  INSERT INTO public.march_walks (event_id, guest_id, walk_no, place_in_walk)
  VALUES (p_event_id, p_joiner, v_walk, v_place)
  ON CONFLICT (event_id, guest_id)
  DO UPDATE SET walk_no = EXCLUDED.walk_no, place_in_walk = EXCLUDED.place_in_walk;
END $$;

-- swap · A and B trade places — walk and place in it. Each one's walk-mate
-- stays where they stood, so every walk keeps its spot and its other half.
CREATE OR REPLACE FUNCTION public.swap_entourage_places(
  p_event_id UUID,
  p_a        UUID,
  p_b        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_found INT;
  v_wa INT;  v_pa SMALLINT;
  v_wb INT;  v_pb SMALLINT;
BEGIN
  IF p_a = p_b THEN
    RAISE EXCEPTION 'Pick a different guest to swap with';
  END IF;

  SELECT count(*) INTO v_found
  FROM public.guests
  WHERE event_id = p_event_id AND guest_id IN (p_a, p_b) AND deleted_at IS NULL;
  IF v_found <> 2 THEN
    RAISE EXCEPTION 'Both guests must belong to this event';
  END IF;

  SELECT walk_no, place_in_walk INTO v_wa, v_pa
  FROM public.march_walks WHERE event_id = p_event_id AND guest_id = p_a FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This walk has no place in the march yet';
  END IF;
  SELECT walk_no, place_in_walk INTO v_wb, v_pb
  FROM public.march_walks WHERE event_id = p_event_id AND guest_id = p_b FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This walk has no place in the march yet';
  END IF;

  IF v_wa = v_wb THEN
    RAISE EXCEPTION 'These two already walk together';
  END IF;

  -- ONE statement: there is no instant at which both stand in the same walk.
  UPDATE public.march_walks
     SET walk_no       = CASE guest_id WHEN p_a THEN v_wb ELSE v_wa END,
         place_in_walk = CASE guest_id WHEN p_a THEN v_pb ELSE v_pa END
   WHERE event_id = p_event_id AND guest_id IN (p_a, p_b);
END $$;

-- order · one section's walks, in the order given, in ONE call.
--
-- `p_orders[i]` is the LINE index of `p_guest_ids[i]` (0..n-1, both people of a
-- line carrying the same index — exactly what `writeLineOrder` already sends).
-- Reorder = renumber: the section's own walk numbers are handed back out in the
-- new order (lowest to the first line), so no other section's walk moves and
-- no number is shared by accident; a line with no walk yet gets a fresh number
-- above everything. A walk-mate in ANOTHER section travels with their walk.
-- Returns how many of the given people now stand where they were asked to —
-- 🔑 a zero is the caller's refusal, never "saved".
CREATE OR REPLACE FUNCTION public.set_entourage_order(
  p_event_id  UUID,
  p_guest_ids UUID[],
  p_orders    INT[]
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max      INT;
  v_line     RECORD;
  v_claimed  INT[] := '{}';
  v_ords     INT[] := '{}';
  v_olds     INT[] := '{}';
  v_pool     INT[];
  v_fresh    INT := 0;
  v_written  INT;
BEGIN
  IF p_guest_ids IS NULL OR p_orders IS NULL
     OR array_length(p_guest_ids, 1) IS DISTINCT FROM array_length(p_orders, 1) THEN
    RAISE EXCEPTION 'Every guest must carry exactly one position';
  END IF;

  SELECT coalesce(max(walk_no), -1) INTO v_max
  FROM public.march_walks WHERE event_id = p_event_id;

  -- Each line, in its new order, with the walk it is in now (if any). A walk
  -- already claimed by an earlier line is not claimed twice — that line gets a
  -- fresh number and its people move off the shared walk.
  FOR v_line IN
    SELECT v.ord, min(m.walk_no) AS old
    FROM unnest(p_guest_ids, p_orders) AS v(gid, ord)
    JOIN public.guests g
      ON g.event_id = p_event_id AND g.guest_id = v.gid AND g.deleted_at IS NULL
    LEFT JOIN public.march_walks m
      ON m.event_id = p_event_id AND m.guest_id = v.gid
    GROUP BY v.ord
    ORDER BY v.ord
  LOOP
    v_ords := v_ords || v_line.ord;
    IF v_line.old IS NOT NULL AND NOT (v_line.old = ANY (v_claimed)) THEN
      v_claimed := v_claimed || v_line.old;
      v_olds := v_olds || v_line.old;
    ELSE
      v_olds := v_olds || NULL::INT;
      v_fresh := v_fresh + 1;
    END IF;
  END LOOP;

  IF coalesce(array_length(v_ords, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  -- The numbers to hand out: this section's own, lowest first, then fresh ones
  -- above every walk in the event. Line i takes the i-th.
  SELECT coalesce(array_agg(n ORDER BY n), '{}') INTO v_pool FROM unnest(v_claimed) AS n;
  IF v_fresh > 0 THEN
    v_pool := v_pool || ARRAY(SELECT v_max + s FROM generate_series(1, v_fresh) AS s);
  END IF;

  -- 1 · carry every claimed walk — all of its people, in any section — to its
  -- new number. ONE statement over the pre-move numbers, so a walk handed the
  -- number another walk is leaving never merges with it.
  UPDATE public.march_walks m
     SET walk_no = x.new_no
    FROM unnest(v_olds, v_pool) AS x(old_no, new_no)
   WHERE m.event_id = p_event_id
     AND x.old_no IS NOT NULL
     AND m.walk_no = x.old_no;

  -- 2 · everyone given who is not now in their line's walk: placed for the
  -- first time, or moved off a walk another line kept.
  INSERT INTO public.march_walks (event_id, guest_id, walk_no, place_in_walk)
  SELECT p_event_id, v.gid, l.new_no,
         (row_number() OVER (PARTITION BY v.ord ORDER BY v.idx) - 1)::SMALLINT
  FROM unnest(p_guest_ids, p_orders) WITH ORDINALITY AS v(gid, ord, idx)
  JOIN public.guests g
    ON g.event_id = p_event_id AND g.guest_id = v.gid AND g.deleted_at IS NULL
  JOIN unnest(v_ords, v_pool) AS l(ord, new_no) ON l.ord = v.ord
  WHERE NOT EXISTS (
    SELECT 1 FROM public.march_walks m
    WHERE m.event_id = p_event_id AND m.guest_id = v.gid AND m.walk_no = l.new_no
  )
  ON CONFLICT (event_id, guest_id)
  DO UPDATE SET walk_no = EXCLUDED.walk_no, place_in_walk = EXCLUDED.place_in_walk;

  SELECT count(*)::INT INTO v_written
  FROM unnest(p_guest_ids, p_orders) AS v(gid, ord)
  JOIN unnest(v_ords, v_pool) AS l(ord, new_no) ON l.ord = v.ord
  JOIN public.march_walks m
    ON m.event_id = p_event_id AND m.guest_id = v.gid AND m.walk_no = l.new_no;

  RETURN v_written;
END $$;

-- unpair · "Leave the other side blank": this person steps out of their walk
-- into one of their own, right behind it. Whoever they walked with keeps the
-- walk and its place.
CREATE OR REPLACE FUNCTION public.unpair_guest(
  p_event_id UUID,
  p_guest_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_walk INT;
BEGIN
  SELECT walk_no INTO v_walk
  FROM public.march_walks
  WHERE event_id = p_event_id AND guest_id = p_guest_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- not in the march: already walking alone
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.march_walks
    WHERE event_id = p_event_id AND walk_no = v_walk AND guest_id <> p_guest_id
  ) THEN
    RETURN; -- already alone
  END IF;

  UPDATE public.march_walks
     SET walk_no = walk_no + 1
   WHERE event_id = p_event_id AND walk_no > v_walk;
  UPDATE public.march_walks
     SET walk_no = v_walk + 1, place_in_walk = 0
   WHERE event_id = p_event_id AND guest_id = p_guest_id;
END $$;

-- 🔒 REVOKE FROM PUBLIC FIRST — Postgres grants EXECUTE on a new function to
-- PUBLIC, so a GRANT to authenticated alone would leave anon able to call it.
REVOKE EXECUTE ON FUNCTION public.join_entourage_line(UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.swap_entourage_places(UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_entourage_order(UUID, UUID[], INT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unpair_guest(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_entourage_line(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.swap_entourage_places(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_entourage_order(UUID, UUID[], INT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpair_guest(UUID, UUID) TO authenticated;

-- ── 6 · the guest-row writers of the march, retired ───────────────────────
-- `pair_guests` wrote `pair_with_guest_id`; `clear_entourage_order` wrote
-- `entourage_order`. Neither has a caller after this change (the Reset link
-- now re-sorts the section's walks — `clearEntourageOrder`).
DROP FUNCTION IF EXISTS public.pair_guests(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.clear_entourage_order(UUID, UUID[]);

-- ── 7 · the columns stay; their march meaning does not ────────────────────
COMMENT ON COLUMN public.guests.pair_with_guest_id IS
  'RETIRED FOR THE WEDDING MARCH (2026-10-01, migration march_is_its_own_table). Who walks with '
  'whom lives in public.march_walks; nothing writes this column any more and the march never '
  'reads it. Kept so a rollback can still read the old pairs. May be DROPPED once '
  '`grep -rn pair_with_guest_id apps/web` finds no reader and this migration has been live in '
  'production for a full deploy cycle.';

COMMENT ON COLUMN public.guests.entourage_order IS
  'RETIRED FOR THE WEDDING MARCH (2026-10-01, migration march_is_its_own_table). A walk''s place '
  'is march_walks.walk_no; nothing writes this column any more and the march never reads it. '
  'May be DROPPED on the same terms as pair_with_guest_id.';

COMMENT ON COLUMN public.guests.couple_with_guest_id IS
  'Whether two guests are a COUPLE — a fact about the people, never about the march '
  '(DECISION_LOG 2026-10-01 "A WALK AND A COUPLE ARE INDEPENDENT"). The Wedding March''s '
  '"They''re a couple" tick that wrote it is retired; a march line always prints both full names.';
