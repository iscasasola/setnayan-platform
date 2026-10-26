-- a_new_category_inherits_its_coarse_category
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- ③0-c part 2 "one source" (corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 8.3).
-- Builds on 20271290647325_one_source_coarse_category_column (service_categories.coarse_category).
--
-- THE RULE (controller decision 2026-10-26, recorded): a NEW category (tier 2) created with no
-- coarse category INHERITS its group's most common `coarse_category` among its sibling
-- categories. Ties → the coarse category of the first sibling by `sort_order`. A group with no
-- sibling that has one → left NULL (the app then files its shops under misc, and the Categories
-- page's "needs a look" check is where it gets listed). An admin can override it later from the
-- Category panel — that control belongs to the Categories page build, not here.
--
-- WHY A TRIGGER and not only the server action: the column must never be left empty by whichever
-- door creates the row — the admin page's `createTaxonomyNode` today, a request promotion or a
-- migration tomorrow. BEFORE INSERT, only when the row is tier 2 AND arrives with NULL, so an
-- explicit value (an admin's choice, a seed) always wins and nothing that already exists is touched.
--
-- Not on UPDATE: moving a category to another group keeps the coarse category it has — what a
-- shop is filed as should change only when someone decides it, not as a side effect of a move.

CREATE OR REPLACE FUNCTION public.service_category_inherit_coarse_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tier = 2 AND NEW.coarse_category IS NULL AND NEW.parent_id IS NOT NULL THEN
    SELECT s.coarse_category
      INTO NEW.coarse_category
      FROM public.service_categories s
     WHERE s.parent_id = NEW.parent_id
       AND s.tier = 2
       AND s.id <> NEW.id
       AND s.coarse_category IS NOT NULL
     GROUP BY s.coarse_category
     ORDER BY count(*) DESC,          -- the group's most common coarse category
              min(s.sort_order) ASC,  -- tie → the first sibling by sort_order
              min(s.id) ASC           -- equal sort_order → deterministic
     LIMIT 1;
    -- No sibling with a value → stays NULL (SELECT INTO with no row assigns NULL).
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.service_category_inherit_coarse_category() IS
  'BEFORE INSERT on service_categories: a new tier-2 category with NULL coarse_category inherits its group''s most common sibling coarse_category (ties → first sibling by sort_order; none → NULL). ③0-c part 2, 2026-10-26.';

REVOKE ALL ON FUNCTION public.service_category_inherit_coarse_category() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS service_categories_inherit_coarse_category ON public.service_categories;
CREATE TRIGGER service_categories_inherit_coarse_category
  BEFORE INSERT ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.service_category_inherit_coarse_category();
