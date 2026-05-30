-- Iteration 0016 · DIY Foundation 9-card wizard substrate.
-- Locked in CLAUDE.md 2026-05-30 evening (owner directive · DIY/Paid
-- bifurcation). Adds the one schema-level dependency the wizard.ts
-- substrate split needs: events.estimated_pax. The rest of the DIY
-- 9-card surface (set_estimated_pax · set_estimated_budget ·
-- add_a_category card components + server actions + dispatcher wiring +
-- Plan grid wire) ships via Agent B in a sibling PR.
--
-- WHY this column.
-- The 9-card DIY Foundation owner specced 2026-05-30 puts an estimated
-- pax card at position #2 (right after set_wedding_date) because the
-- guest count is the single biggest input to reception venue sizing,
-- catering quote, and invitation print run. Filipino weddings routinely
-- grow from 80 to 200 between engagement and RSVP — anchoring the rough
-- count up-front prevents downstream churn (per the same reasoning
-- behind the 2026-05-24 draft_guest_list reorder from order 4.5 to 1.5).
--
-- A single INT column with a CHECK constraint covers the use case
-- without overspecifying. The card body is a simple number input ·
-- value persists to events.estimated_pax · downstream cater-portion
-- math + invitation count reads from this column.
--
-- WHY a separate column from events.wedding_budget_centavos.
-- Budget is already represented (events.wedding_budget_centavos · seeded
-- in earlier migrations + read by ShortlistBudgetCard surfaces). Pax is
-- a different unit (count, not currency) + a different downstream
-- consumer set (caterer + venue + invitation print run vs the financial
-- ledger) · separate column avoids overloading the budget column with
-- guest-count semantics.
--
-- WHY 0 < pax < 10000 in the CHECK.
-- Lower bound prevents accidental 0 saves (would zero out cater
-- portions + invitation counts downstream). Upper bound prevents
-- runaway typos (10000-guest weddings exist in Filipino political /
-- entertainment-industry context but they're outliers · 9999 is high
-- enough to catch every realistic event without overflowing INT
-- arithmetic in the downstream multiplier paths).
--
-- WHY NULL default.
-- The 9-card DIY sequence treats the column as a host_data_input task ·
-- the card stays in the carousel until the host fills it in. NULL is
-- the "not yet provided" signal that drives the active-focus walk in
-- wizard.ts. A DEFAULT 0 would falsely mark the task as settled the
-- moment the event row was created.
--
-- Idempotent: the IF NOT EXISTS guard makes this safe to re-run on a
-- prod database that already has the column from a prior partial push.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS estimated_pax INT NULL
    CHECK (estimated_pax IS NULL OR (estimated_pax > 0 AND estimated_pax < 10000));

COMMENT ON COLUMN public.events.estimated_pax IS
  'Host-provided estimated guest count. Drives downstream cater-portion '
  'math, invitation count, venue sizing guidance. NULL until host '
  'completes the Set Estimated Pax wizard card. Locked 2026-05-30 in '
  'CLAUDE.md DIY Foundation 9-card row (iteration 0016).';
