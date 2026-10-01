-- host_roles_add_best_woman
-- Created via `pnpm migration:new`. Idempotent.
--
-- Owner, verbatim 2026-09-30: "We can pick either best man or best woman and
-- maid or matron of honor." The guest list gains `best_woman`
-- (20271253806528); a best woman invited to HELP plan must be able to hold the
-- same host seat a best man can — `lib/host-roles.ts` now offers `best_woman`
-- beside `best_man`, with the same permission template (edit, no checkout).
--
-- 🔑 THE CONSTRAINT AND THE TYPESCRIPT MOVE TOGETHER (see
-- 20271141655967_host_roles_event_type_breadth.sql): an offered role the CHECK
-- does not list is an invite the database rejects, shown to the host as a
-- generic failure. `tests/db/host-roles-check-constraint.db.test.ts` fails if
-- the two ever disagree, in either direction.
--
-- NOTHING IS REMOVED. Every one of the 17 existing values stays legal, in its
-- existing order; `best_woman` is appended to the wedding set.

BEGIN;

ALTER TABLE public.event_moderators
  DROP CONSTRAINT IF EXISTS event_moderators_role_subtype_check;

ALTER TABLE public.event_moderators
  ADD CONSTRAINT event_moderators_role_subtype_check
  CHECK (role_subtype = ANY (ARRAY[
    -- the original wedding set — unchanged, order preserved
    'bride'::text,
    'groom'::text,
    'partner1'::text,
    'partner2'::text,
    'parent_of_bride'::text,
    'parent_of_groom'::text,
    'maid_of_honor'::text,
    'best_man'::text,
    'wedding_planner_external'::text,
    'ninong'::text,
    'ninang'::text,
    'family_helper'::text,
    'viewer'::text,
    -- generic roles for the other 15 event types (20271141655967)
    'celebrant'::text,
    'parent'::text,
    'host'::text,
    'co_host'::text,
    -- owner 2026-09-30 — the groom's honour attendant may be a woman
    'best_woman'::text
  ]));

COMMENT ON COLUMN public.event_moderators.role_subtype IS
  'Host role. 18 legal values: the original 13 wedding roles, celebrant / parent / host / '
  'co_host for the other 15 event types, and best_woman (owner 2026-09-30). WHICH roles an '
  'event type offers is decided in apps/web/lib/host-roles.ts — never widen that list '
  'without widening this constraint in the same PR, or the invite is rejected here and the '
  'host only sees a generic failure.';

COMMIT;
