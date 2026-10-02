## 2026-10-02 · fix(home): the "Kumusta…" hero leaves — the first screen's cover is the greeting

Owner ruling 2026-10-01 (DECISION_LOG "HOME ON DESKTOP SHOWS EACH THING ONCE" + "THE SIMPLE PHONE APP —
APPROVED", frame 1). #6232 already removed days to go, coming / no reply, Paid / Still owing and the
Next-vs-"Needs you this week" overlap from under the first screen. The one block it left was the
"Kumusta, <name> · welcome back / Your wedding is taking shape. Here's today." hero, which frame 1 does not
draw. With the first screen above, `EventDashboard` now does not render it (removed, not hidden behind a
breakpoint: `firstScreenRepeats().hero`). The day-of and after-the-day mounts have no first screen above
them and keep it. The page's one `<h1>` moves to the first screen's cover (the event name). The guard
`the-home-leads-with-one-next.test.ts` gains the hero gate, a count of every first-screen gate the
dashboard reads, and "exactly one h1".

SPEC IMPACT: None.
