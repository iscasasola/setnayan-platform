## 2026-11-16 · fix(events): old one-pick events get their date saved

A one-time fill (owner 16 Nov, "a"): events made before 14 Nov whose couple picked ONE day at sign-up kept it as a lone
option with no date. Each now gets that day as its date — day precision, option cleared, date locked — and every Papic
camera on it with no window gets the default window (6 months before → the day + 12 hours), the same state a new
one-pick event is born in since PR #7615. Rows with 2+ options, a window, or a date are untouched. No history line or
supplier chat line is written (nobody changed anything). Prod measured: 5 rows, 3 with Papic on. Reaches prod only by
merge → deploy db push.

SPEC IMPACT: None (DECISION_LOG 16 Nov "OLD ONE-PICK EVENTS GET THEIR DATE SAVED" already records it).
