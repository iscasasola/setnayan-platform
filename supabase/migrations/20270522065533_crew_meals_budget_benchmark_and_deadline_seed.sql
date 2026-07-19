-- crew_meals_budget_benchmark_and_deadline_seed
--
-- Registers the `crew_meals` plan group in the two per-category CONFIG tables
-- that are seeded by row (no code type-guard), so the Crew Meals category shows
-- up coherently in the couple's Budget Planner + the admin surfaces. Part of the
-- Crew-Meal Provider Marketplace (owner-locked 2026-07-08; category + plan group
-- shipped in PR #2870).
--
-- Idempotent (ON CONFLICT DO NOTHING) — safe to re-apply.
--
-- 1) budget_leaf_benchmarks (20260826000000): the admin Budget Planner + the
--    couple's allocation planner iterate THIS table's rows. Without a row,
--    crew_meals never appears as an allocatable budget leaf. Price columns stay
--    NULL by design ("never invent a benchmark" — admin fills them later).
--    sort_order 35 places it just after Catering (30), before Photography (40).
INSERT INTO public.budget_leaf_benchmarks (plan_group_id, label, sort_order)
VALUES ('crew_meals', 'Crew Meals', 35)
ON CONFLICT (plan_group_id) DO NOTHING;

-- 2) planning_deadlines (20260802000000): per-category deadline defaults keyed
--    by plan-group id. Reminders already fall back to PLAN_GROUPS.monthsBefore
--    (=1) in code, but the admin taxonomy view flags a category with no seeded
--    deadline row. 1 month matches monthsBefore: crew meals is a late, small
--    decision booked close to the day.
INSERT INTO public.planning_deadlines (kind, ref_key, scope, label, offset_value, offset_unit)
VALUES ('service', 'crew_meals', 'category', 'Crew Meals', 1, 'month')
ON CONFLICT (kind, ref_key, scope) DO NOTHING;
