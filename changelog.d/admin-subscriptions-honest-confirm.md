## 2026-09-18 · fix(admin): subscriptions confirm banner says what actually happened

`approveSubscription`'s confirm banner always read "Payment confirmed and the
plan activated" — even for a downgrade, which `_apply_subscription_credit`'s
`deferred: true` branch never activates today: it only schedules the cheaper
plan to start when the vendor's current paid term ends. The action now reads
that flag off the RPC result and the page renders a distinct banner for a
deferred downgrade, so an admin isn't told a plan changed when it didn't.

SPEC IMPACT: None.
