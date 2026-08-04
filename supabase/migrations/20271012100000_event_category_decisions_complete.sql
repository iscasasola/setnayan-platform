-- Explore Replan slice A (Explore_Replan_BUILD_SPEC_2026-07-27.md §3 PR-A):
-- add 'complete' to event_category_decisions.decision — the couple's explicit
-- "I'm done with this category" answer from the post-lock toast (multi-pick)
-- or the automatic hard-single fill. Additive CHECK widening only: existing
-- 'excluded' / 'deferred' rows, the (event_id, plan_group_id) unique key, and
-- the couple-own RLS policies are all untouched.
--
-- Verify the OBJECT after applying (schema_migrations can lie):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'public.event_category_decisions'::regclass
--      AND conname = 'event_category_decisions_decision_check';

ALTER TABLE public.event_category_decisions
  DROP CONSTRAINT event_category_decisions_decision_check;

ALTER TABLE public.event_category_decisions
  ADD CONSTRAINT event_category_decisions_decision_check
  CHECK (decision IN ('excluded', 'deferred', 'complete'));
