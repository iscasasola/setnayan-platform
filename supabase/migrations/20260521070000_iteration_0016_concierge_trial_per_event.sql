-- Iteration 0016 — Concierge trial dual-scope lock.
-- Locked 2026-05-20 (owner directive — see CLAUDE.md decision log).
--
-- Pre-existing rule (2026-05-17): the 3-day free trial was ONE PER ACCOUNT only,
-- tracked on users.concierge_trial_used_at. That closed the within-account
-- abuse loophole (couple creates Event A → exhausts trial → creates Event B
-- for "another" trial on the same account), but didn't address the parallel
-- vector that V1.2 multi-moderator events (iteration 0048) open up: two
-- hosts on the SAME event each spending their own per-account trial slot on
-- the same wedding.
--
-- New rule (2026-05-20): the 3-day trial is ONE PER ACCOUNT *AND* ONE PER
-- EVENT. The first host to start the trial consumes both their own account
-- trial slot AND the event trial slot. Any other host on the same event
-- whose account trial is still fresh is blocked from starting a second
-- trial against that event — they would have to bring their own (different)
-- event to use their account trial.
--
-- Columns
--   events.concierge_trial_used_at        — timestamp of the trial-start
--                                            (NULL until first start)
--   events.concierge_trial_started_by_user_id
--                                          — audit pointer to the host who
--                                            started the trial (NULL until
--                                            first start)
--
-- Backfill: existing events whose concierge_status='trial' get a backfill
-- to concierge_activated_at so the new rule applies cleanly to currently-
-- in-progress trials. Events in 'active' / 'expired' are intentionally
-- left NULL — they may have purchased directly without trialing, and we
-- can't tell from the schema alone. The trade-off is that a fresh-account
-- moderator on an old 'active' event could theoretically still start their
-- own trial, but the user-side check (users.concierge_trial_used_at) plus
-- the abuse-flag pipeline still catches the cross-account abuse pattern;
-- the per-event lock primarily protects new events going forward.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS concierge_trial_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concierge_trial_started_by_user_id UUID
    REFERENCES users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN events.concierge_trial_used_at IS
  'Iteration 0016 (2026-05-20 dual-scope lock): timestamp when the 3-day trial was first started on this event. Once stamped, no other moderator can start their own per-account trial against this event. NULL until first start.';

COMMENT ON COLUMN events.concierge_trial_started_by_user_id IS
  'Iteration 0016 (2026-05-20 dual-scope lock): audit pointer to the moderator who consumed the per-event trial slot. NULL until first start.';

-- Backfill currently-in-trial events so the new lock applies cleanly.
UPDATE events
SET concierge_trial_used_at = concierge_activated_at
WHERE concierge_status = 'trial'
  AND concierge_activated_at IS NOT NULL
  AND concierge_trial_used_at IS NULL;
