-- host_roles_add_man_of_honor
-- Created via `pnpm migration:new`. Idempotent.
--
-- Owner, verbatim 2026-10-19 (DECISION_LOG "A MAN OF HONOR"): "we give them a
-- choice maid/matron/man of honor. so they can have male/female version like
-- bestman and best woman". The guest list gains `man_of_honor`
-- (20271277879483); a man of honor invited to HELP plan must be able to hold
-- the same host seat a maid of honor can — `lib/host-roles.ts` now offers
-- `man_of_honor` beside `maid_of_honor`, with the same permission template
-- (edit, no checkout). The exact mirror of `best_woman`
-- (20271253824781_host_roles_add_best_woman.sql).
--
-- 🔑 THE CONSTRAINT AND THE TYPESCRIPT MOVE TOGETHER: an offered role the CHECK
-- does not list is an invite the database rejects, shown to the host as a
-- generic failure. `tests/db/host-roles-check-constraint.db.test.ts` fails if
-- the two ever disagree, in either direction.
--
-- NOTHING IS REMOVED. Every one of the 18 existing values stays legal, in its
-- existing order (copied from 20271253824781, the latest definition);
-- `man_of_honor` is appended.

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
    'best_woman'::text,
    -- owner 2026-10-19 — the bride's honour attendant may be a man
    'man_of_honor'::text
  ]));

COMMENT ON COLUMN public.event_moderators.role_subtype IS
  'Host role. 19 legal values: the original 13 wedding roles, celebrant / parent / host / '
  'co_host for the other 15 event types, best_woman (owner 2026-09-30) and man_of_honor '
  '(owner 2026-10-19). WHICH roles an event type offers is decided in apps/web/lib/host-roles.ts '
  '— never widen that list without widening this constraint in the same PR, or the invite is '
  'rejected here and the host only sees a generic failure.';

COMMIT;
