-- ============================================================================
-- RECURSIVE PACKAGE CUSTOMIZATION — schema foundation.
--
-- Extends `vendor_package_items` with the three axes the couple-side
-- configurator needs before a package can branch. All THREE columns are
-- NULLABLE and default to TODAY'S behaviour, so every existing row — and every
-- row written by code that has not been taught about them — is unchanged.
--
--   1. parent_option_id  — a FOLLOW-UP line. The couple only ever sees this
--                          line once a specific OPTION on another line is
--                          chosen ("Buffet → Beef caldereta" reveals "Choose
--                          your side"). NULL = a normal top-level line, which
--                          is every row that exists today.
--   2. pick_min/pick_max — a "choose 3 of 5" line. NULL/NULL = today's
--                          behaviour: a choice line takes exactly one option.
--   3. max_extra_hours   — a cap on the hourly model that ALREADY exists on
--                          this table (hour_base_centavos / min_hours /
--                          extra_hour_centavos). See the column comment: this
--                          is deliberately NOT a generic quantity column.
--
-- ── WHY parent_option_id AND NOT parent_item_id ─────────────────────────────
-- The reveal is triggered by a specific ALTERNATIVE, not by the line. "Show the
-- side-dish line" is only meaningful once you know WHICH main course was
-- picked. Pointing at the item would force a second column to say which of its
-- options armed it, and two columns that must agree is a class of bug this
-- table already avoided once (see 20271006413374 on why options are a child
-- table rather than self-referencing items).
--
-- ── WHY ON DELETE CASCADE ───────────────────────────────────────────────────
-- Deliberate, and the opposite of the usual instinct. A follow-up has NO
-- meaning once the option that reveals it is gone: it is unreachable by
-- construction. SET NULL would be actively dangerous — it PROMOTES the
-- follow-up into a top-level line, so a "Choose your side" that only ever
-- applied to one main course would suddenly show on every booking, and its
-- replacement_value_centavos would enter the credit pool for couples who never
-- picked the parent. Cascading deletes the unreachable line instead of
-- silently publishing it.
--
-- ── THE CYCLE + DEPTH GUARD ─────────────────────────────────────────────────
-- `parent_option_id` turns a package's lines into a TREE, and a cycle would
-- hang the couple-side renderer (it walks children to decide what to show). A
-- foreign key cannot see a cycle, and a CHECK constraint cannot query another
-- row, so the guard is a set of triggers. Four shapes are refused:
--
--   (a) a line hanging off an option of ITSELF        package_followup_self_parent
--   (b) a cycle anywhere up the parent chain          package_followup_cycle
--   (c) a chain deeper than 5 levels                  package_followup_too_deep
--   (d) a parent option in a DIFFERENT package        package_followup_cross_package
--
-- (d) matters as much as the others: `parent_option_id` is a bare FK to an
-- options table that spans every vendor, so without it one vendor's package
-- could hang a line off another vendor's option — a cross-tenant link between
-- two packages, and a cascade delete nobody owns.
--
-- ⚠ THREE TRIGGERS, NOT ONE — AND THAT IS THE WHOLE POINT.
-- `parent_option_id` is an edge with THREE endpoints that can each move
-- independently, so guarding only the row that carries the column leaves two
-- doors open. Both were found by adversarial review, and both are reachable
-- with an ordinary authenticated UPDATE that RLS permits:
--
--   1. THE OPTION MOVES. Line A owns option `oa`; follow-up B hangs off `oa`.
--      Now `UPDATE vendor_package_item_options SET item_id = B WHERE option_id
--      = oa`. B's parent option now lives on B itself. Nothing on
--      `vendor_package_items` was written, so a trigger on that table alone
--      never fires — and the renderer recurses forever.
--   2. THE PARENT LINE IS RE-PACKAGED. The cross-package check compares the
--      parent's package to the CHILD row being written. Moving the PARENT's
--      `package_id` never re-validates its children, so the follow-up ends up
--      pointing across packages by a route the child-side check cannot see.
--
-- So the walk is factored into ONE function that all three triggers share
-- (duplicating it is how the copies drift apart), and the two new triggers are
-- AFTER, not BEFORE. That is load-bearing: a BEFORE trigger reads the
-- statement's own snapshot, in which the row being written still holds its OLD
-- `item_id` / `package_id`, so the check would validate the state it is trying
-- to prevent and pass.
--
-- The trigger functions are SECURITY DEFINER with a pinned `search_path`, for
-- two reasons. Practically: a trigger function is invoked by the system and its
-- own EXECUTE privilege is never checked, but a `PERFORM` of a REVOKEd helper
-- inside it IS checked against the calling user — so an INVOKER trigger calling
-- a locked-down helper would fail with "permission denied" on every vendor's
-- INSERT. Substantively: RLS would otherwise hide rungs of the chain from the
-- walk, and a guard that cannot see the whole chain is a guard that can be
-- walked around. They only READ and RAISE — they write nothing and return no
-- data, so the definer rights buy completeness and nothing else.
--
-- NO NEW TABLES, so no new RLS policies: the columns live on
-- `vendor_package_items` and inherit its existing policies verbatim.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT / CREATE OR REPLACE FUNCTION /
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER, per the repo convention.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. parent_option_id — the follow-up link
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS parent_option_id UUID
    REFERENCES public.vendor_package_item_options(option_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.vendor_package_items.parent_option_id IS
  'FOLLOW-UP line: the couple sees this line only once this specific option is chosen on another line. NULL = a normal top-level line (every row before this migration). ON DELETE CASCADE is deliberate - a follow-up is unreachable once its parent option is gone, and SET NULL would PROMOTE it into a line every couple sees. Cycles, self-parents, >5 depth and cross-package parents are refused by trigger vendor_package_items_guard_followup.';

-- Partial: only follow-ups are ever looked up this way, and today that is zero
-- rows. The index serves the renderer's "what does this option reveal?" query
-- and the ON DELETE CASCADE's own parent scan.
CREATE INDEX IF NOT EXISTS vendor_package_items_parent_option_idx
  ON public.vendor_package_items (parent_option_id)
  WHERE parent_option_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. pick_min / pick_max — "choose 3 of 5"
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS pick_min INT;
ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS pick_max INT;

COMMENT ON COLUMN public.vendor_package_items.pick_min IS
  'Minimum options the couple must pick on this CHOICE line. NULL (with pick_max NULL) = today''s behaviour: exactly one option. Set together with pick_max - see vendor_package_items_pick_range_ck.';
COMMENT ON COLUMN public.vendor_package_items.pick_max IS
  'Maximum options the couple may pick on this CHOICE line. NULL (with pick_min NULL) = today''s behaviour: exactly one option. Set together with pick_min - see vendor_package_items_pick_range_ck.';

-- BOTH-OR-NEITHER, and >= 1 when set. A half-set pair has no defined meaning:
-- "at least 2, no maximum" would have to be read off the option count, which
-- lives in a different table, so a reader would have to guess. pick_min = 0 is
-- refused too - a line nobody has to pick from is an OPTIONAL line, which is
-- already expressible via is_required / is_default_included, and allowing two
-- spellings of one fact is how two sources of truth start disagreeing.
ALTER TABLE public.vendor_package_items
  DROP CONSTRAINT IF EXISTS vendor_package_items_pick_range_ck;
ALTER TABLE public.vendor_package_items
  ADD CONSTRAINT vendor_package_items_pick_range_ck
  CHECK (
    (pick_min IS NULL AND pick_max IS NULL)
    OR (pick_min IS NOT NULL AND pick_max IS NOT NULL
        AND pick_min >= 1 AND pick_max >= 1
        AND pick_min <= pick_max)
  );

-- ----------------------------------------------------------------------------
-- 3. max_extra_hours — a cap on the HOURLY model that already exists
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS max_extra_hours INT;

-- ⚠ READ THIS BEFORE REACHING FOR A GENERIC QUANTITY COLUMN.
-- The design draft called this "max_qty". There is NO generic quantity concept
-- anywhere in this schema: the only quantity axis `vendor_package_items` has is
-- the hourly model already on the table (hour_base_centavos covers min_hours,
-- and each hour beyond that costs extra_hour_centavos). So this EXTENDS that
-- model rather than inventing a second one - it is the ceiling on how many
-- extra hours a couple may add. A generic quantity would need its own unit, its
-- own price basis and its own pricing branch, none of which exist.
COMMENT ON COLUMN public.vendor_package_items.max_extra_hours IS
  'Ceiling on the EXTRA HOURS a couple may add to this line, on top of min_hours. Extends the hourly model already on this table (hour_base_centavos / min_hours / extra_hour_centavos) - it is NOT a generic quantity cap, because no generic quantity concept exists in this schema. NULL = uncapped (today''s behaviour). 0 = the line is fixed at min_hours.';

ALTER TABLE public.vendor_package_items
  DROP CONSTRAINT IF EXISTS vendor_package_items_max_extra_hours_ck;
ALTER TABLE public.vendor_package_items
  ADD CONSTRAINT vendor_package_items_max_extra_hours_ck
  CHECK (max_extra_hours IS NULL OR max_extra_hours >= 0);

-- ----------------------------------------------------------------------------
-- 4a. THE WALK — one function, shared by every trigger below
-- ----------------------------------------------------------------------------

-- Validates ONE follow-up link. Every trigger in 4b/4c/4d calls this and only
-- this, so there is exactly one definition of what a legal follow-up is. The
-- earlier draft inlined the walk in the single trigger that existed then; a
-- second copy for the options side would have been a second definition, and two
-- copies of a rule drift.
CREATE OR REPLACE FUNCTION public.assert_package_followup_ok(
  p_item_id          UUID,
  p_package_id       UUID,
  p_parent_option_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- The maximum number of ancestor LEVELS a follow-up may sit above its
  -- top-level line. 5 is a product bound, not a technical one: a couple asked
  -- to answer six nested questions to configure one inclusion has been handed a
  -- form, not a choice. The number is stated in the error message so a vendor
  -- reads it rather than guesses it.
  v_max_depth   CONSTANT INT := 5;
  v_parent_item UUID;
  v_parent_pkg  UUID;
  v_cursor      UUID;
  v_depth       INT := 0;
BEGIN
  -- A top-level line, which is every row today. Nothing to walk.
  IF p_parent_option_id IS NULL THEN
    RETURN;
  END IF;

  SELECT i.item_id, i.package_id
    INTO v_parent_item, v_parent_pkg
    FROM public.vendor_package_item_options o
    JOIN public.vendor_package_items i ON i.item_id = o.item_id
   WHERE o.option_id = p_parent_option_id;

  -- The FK normally catches this; a BEFORE trigger runs first, so say something
  -- readable rather than letting the constraint speak.
  IF v_parent_item IS NULL THEN
    RAISE EXCEPTION
      'package_followup_parent_missing: parent_option_id % does not name an option',
      p_parent_option_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- (a) an option of the line itself. Zero-length cycle; the walk below would
  --     never see it, because the walk starts AT the parent.
  IF v_parent_item = p_item_id THEN
    RAISE EXCEPTION
      'package_followup_self_parent: a follow-up cannot hang off an option of its own line'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (d) same package. parent_option_id is a bare FK across every vendor's
  --     options, so without this one package could reveal a line off another
  --     vendor's option - a cross-tenant link, and a cascade delete nobody owns.
  IF v_parent_pkg IS DISTINCT FROM p_package_id THEN
    RAISE EXCEPTION
      'package_followup_cross_package: a follow-up must belong to the same package as the option that reveals it'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) + (c) walk the parent chain to the root, counting levels.
  v_cursor := v_parent_item;
  WHILE v_cursor IS NOT NULL LOOP
    v_depth := v_depth + 1;
    IF v_depth > v_max_depth THEN
      RAISE EXCEPTION
        'package_followup_too_deep: a follow-up can be at most 5 levels from its line'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT anc.item_id
      INTO v_cursor
      FROM public.vendor_package_items child
      JOIN public.vendor_package_item_options o ON o.option_id = child.parent_option_id
      JOIN public.vendor_package_items anc ON anc.item_id = o.item_id
     WHERE child.item_id = v_cursor;

    -- NOT FOUND leaves v_cursor NULL, which ends the loop at the root.
    IF v_cursor = p_item_id THEN
      RAISE EXCEPTION
        'package_followup_cycle: a follow-up cannot be its own ancestor'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.assert_package_followup_ok(UUID, UUID, UUID) IS
  'The single definition of a legal follow-up link: refuses a self-parent, a cycle, a chain more than 5 levels deep, and a parent option in a different package. Called by all three vendor_package_items / vendor_package_item_options guards. Mirrored in TS by validatePackageDraft (lib/package-authoring.ts) so a vendor reads a sentence instead of a 23514.';

-- Re-validates a line AND everything hanging off it, from whatever those rows
-- currently hold. Needed because moving one row can invalidate a subtree the
-- moved row does not itself belong to: re-packaging a parent breaks its
-- children's same-package link, and re-homing an option can push a whole
-- subtree past the depth cap.
--
-- Terminating by construction, twice over: `UNION` (not `UNION ALL`) discards
-- rows already produced, so an existing cycle cannot loop, and the explicit
-- depth bound stops the walk regardless. The bound is far above the 5-level
-- product cap on purpose — this function must be able to WALK a structure that
-- is already illegal in order to report it.
CREATE OR REPLACE FUNCTION public.assert_package_followup_subtree_ok(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    WITH RECURSIVE subtree(item_id, package_id, parent_option_id, depth) AS (
      SELECT i.item_id, i.package_id, i.parent_option_id, 0
        FROM public.vendor_package_items i
       WHERE i.item_id = p_item_id
      UNION
      SELECT c.item_id, c.package_id, c.parent_option_id, s.depth + 1
        FROM subtree s
        JOIN public.vendor_package_item_options o ON o.item_id = s.item_id
        JOIN public.vendor_package_items c ON c.parent_option_id = o.option_id
       WHERE s.depth < 20
    )
    SELECT * FROM subtree
  LOOP
    PERFORM public.assert_package_followup_ok(
      r.item_id, r.package_id, r.parent_option_id);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.assert_package_followup_subtree_ok(UUID) IS
  'Re-runs assert_package_followup_ok over a line and every follow-up beneath it. Used where a single write invalidates rows OTHER than the one written: re-packaging a parent line, and moving an option to another line.';

-- Neither helper is a trigger function, so PostgREST WOULD publish both at
-- /rest/v1/rpc/ and both would land on the exposure surface. REVOKE is what
-- keeps them off it. `FROM PUBLIC` alone is a NO-OP against anon and
-- authenticated on Supabase — their EXECUTE comes from the platform's own
-- default privileges, which are separate ACL entries — so both roles are named.
REVOKE ALL ON FUNCTION public.assert_package_followup_ok(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_package_followup_subtree_ok(UUID)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4b. The row that carries the column
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_package_item_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_package_followup_ok(
    NEW.item_id, NEW.package_id, NEW.parent_option_id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_package_item_followup() IS
  'BEFORE INSERT OR UPDATE on vendor_package_items: validates the row''s own follow-up link via assert_package_followup_ok.';

-- A trigger-returning function is not published by PostgREST and the exposure
-- collector excludes it for that reason, so this REVOKE is belt over braces —
-- kept because the next author should not have to know that exclusion exists.
REVOKE ALL ON FUNCTION public.guard_package_item_followup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_package_items_guard_followup
  ON public.vendor_package_items;
CREATE TRIGGER vendor_package_items_guard_followup
  BEFORE INSERT OR UPDATE ON public.vendor_package_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_package_item_followup();

-- ----------------------------------------------------------------------------
-- 4c. THE PARENT LINE MOVES — re-validate the children it left behind
-- ----------------------------------------------------------------------------

-- The same-package rule in 4a compares the parent's package to the CHILD row.
-- Nothing re-checks it when the PARENT is the row that moves, so without this
-- trigger a follow-up ends up pointing across packages by a route the
-- child-side check structurally cannot see.
--
-- AFTER, not BEFORE: at BEFORE time the row still reads with its OLD
-- package_id, so the walk would validate the state this is meant to prevent.
CREATE OR REPLACE FUNCTION public.guard_package_item_repackage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_package_followup_subtree_ok(NEW.item_id);
  RETURN NULL; -- AFTER trigger: the return value is ignored
END;
$$;

COMMENT ON FUNCTION public.guard_package_item_repackage() IS
  'AFTER UPDATE OF package_id on vendor_package_items: re-validates the moved line''s whole follow-up subtree, because moving a PARENT breaks its children''s same-package link and the child-side check never fires.';

REVOKE ALL ON FUNCTION public.guard_package_item_repackage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_package_items_guard_repackage
  ON public.vendor_package_items;
CREATE TRIGGER vendor_package_items_guard_repackage
  AFTER UPDATE OF package_id ON public.vendor_package_items
  FOR EACH ROW
  WHEN (OLD.package_id IS DISTINCT FROM NEW.package_id)
  EXECUTE FUNCTION public.guard_package_item_repackage();

-- ----------------------------------------------------------------------------
-- 4d. THE OPTION MOVES — the cycle nobody on the items side can see
-- ----------------------------------------------------------------------------

-- Line A owns option `oa`; follow-up B hangs off `oa`. Move `oa` onto B and B's
-- parent option now lives on B itself — a cycle built without writing a single
-- byte to vendor_package_items, so the 4b trigger never fires. The same move
-- can also carry a subtree across packages or past the depth cap, which is why
-- this re-validates the whole subtree rather than the direct child alone.
--
-- INSERT is covered for completeness only: an option's id is minted at insert,
-- so nothing can already reference it (the FK would have refused). It is one
-- indexed lookup that finds nothing, and leaving it out would be an invariant
-- that holds "except on the path nobody thought about".
CREATE OR REPLACE FUNCTION public.guard_package_option_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.item_id IS NOT DISTINCT FROM OLD.item_id THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT i.item_id
      FROM public.vendor_package_items i
     WHERE i.parent_option_id = NEW.option_id
  LOOP
    PERFORM public.assert_package_followup_subtree_ok(r.item_id);
  END LOOP;

  RETURN NULL; -- AFTER trigger: the return value is ignored
END;
$$;

COMMENT ON FUNCTION public.guard_package_option_move() IS
  'AFTER INSERT OR UPDATE OF item_id on vendor_package_item_options: re-validates every follow-up the option reveals, plus their subtrees. Closes the cycle that can be built entirely from the OPTIONS side, where no write to vendor_package_items ever happens.';

REVOKE ALL ON FUNCTION public.guard_package_option_move() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_package_item_options_guard_move
  ON public.vendor_package_item_options;
CREATE TRIGGER vendor_package_item_options_guard_move
  AFTER INSERT OR UPDATE OF item_id ON public.vendor_package_item_options
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_package_option_move();

COMMIT;

-- ── Post-condition: the columns landed, and they landed NULLABLE. ───────────
-- `ADD COLUMN IF NOT EXISTS` no-ops silently when a column already exists in a
-- different shape, and this repo has been bitten by exactly that (see
-- tests/db/schema-drift.db.test.ts). Assert the OBJECT, not the ledger.
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(c.name, ', ')
    INTO v_missing
    FROM (VALUES ('parent_option_id'), ('pick_min'), ('pick_max'), ('max_extra_hours')) AS c(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vendor_package_items'
        AND column_name = c.name
        AND is_nullable = 'YES'
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'package branching columns missing or NOT NULL: %', v_missing;
  END IF;
END $$;

-- ── Post-condition: ALL THREE guards are installed. ─────────────────────────
-- One trigger guards one endpoint of the follow-up edge. Two of the three were
-- missing in the first draft of this migration and each omission was a live
-- cycle route, so their presence is asserted rather than assumed.
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(t.name, ', ')
    INTO v_missing
    FROM (VALUES
      ('vendor_package_items_guard_followup'),
      ('vendor_package_items_guard_repackage'),
      ('vendor_package_item_options_guard_move')
    ) AS t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger WHERE tgname = t.name AND NOT tgisinternal
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'package follow-up guard triggers missing: %', v_missing;
  END IF;
END $$;
