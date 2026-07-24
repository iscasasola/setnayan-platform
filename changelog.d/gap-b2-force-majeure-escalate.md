## 2026-07-24 · fix(disputes): stale force-majeure flags ESCALATE, never silently self-resolve

Gap audit 2026-07-23 · Batch B2. `sweepAutoResolveStaleFlags` fired from any page
that surfaced force-majeure flags — the admin triage queue AND the couple's own
disputes page — and UPDATE'd every stale `open`/`under_review` flag to
`'resolved'` from that mere pageview. So an untouched typhoon dispute silently
closed the moment an admin (or the couple themselves) opened the page, and the
"ESCALATED tag" the help + tour copy explicitly promise (help.ts:568,
tours.ts:272) never existed.

- New `'escalated'` status (migration `20270920601523` widens the CHECK; label
  "Escalated", danger tone).
- The sweep (renamed `sweepEscalateStaleFlags`) now sets `'escalated'` with NO
  resolution stamped — the flag STAYS in the admin queue for a real human.
- The admin default filter (`open_set`) admits `escalated`, so it never vanishes.

Now the code matches the shipped copy; nothing auto-CLOSES a dispute without an
admin. No existing force-majeure test; tsc 0 · next lint 0 · timestamp-guard clean.

SPEC IMPACT: None — aligns behavior with the already-published escalation promise.
