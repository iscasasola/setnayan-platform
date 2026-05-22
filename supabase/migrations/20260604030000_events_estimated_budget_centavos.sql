-- Budget setter: host enters their total wedding budget target.
-- Closes the BudgetCountdownHeader loop landed in PR #329 (2026-05-22)
-- where the header was already wired to read events.estimated_budget_centavos
-- defensively but the column didn't exist yet in production schema.
--
-- BIGINT chosen over INTEGER for headroom: ₱100M (the form's hard upper bound)
-- is 10_000_000_000 centavos, which fits INTEGER's 2_147_483_647 ceiling
-- only when the cap holds — BIGINT keeps the column safe if the cap ever
-- grows. Matches the prompt's spec verbatim.
--
-- NULL = host has not yet set a budget. BudgetCountdownHeader interprets
-- NULL as "Set your budget" CTA state per its existing render logic.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS estimated_budget_centavos BIGINT;

COMMENT ON COLUMN events.estimated_budget_centavos IS
  'Host-entered total wedding budget target in PHP centavos. NULL = host has not yet set a budget. Read by BudgetCountdownHeader on event home (CLAUDE.md 2026-05-22 row 1 ''V1 pilot Home v2''). Setter UI lives at /dashboard/[eventId]/budget. BIGINT (not INTEGER) for headroom beyond the form''s ₱100M hard cap.';
