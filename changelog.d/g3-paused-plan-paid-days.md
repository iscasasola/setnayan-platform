## 2026-11-18 · fix(gifts): a paused paid plan keeps its paid days — its purchase moves with it

When a Setnayan plan gift pauses a shop's own paid plan, the hand-back now also moves that plan's paid `vendor_subscriptions.expires_at` forward by the time it was paused, so it agrees with the profile again. While the gift runs, `vendor_unused_plan_value_php` reads the plan as of the day the gift began, so a plan change quoted during the gift credits the days the shop had left, not fewer each day. Both are in the unapplied G3 migration (`20271345573127`); DB test 11 covers it and fails when the shift is removed.

SPEC IMPACT: None.
