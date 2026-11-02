## 2026-07-22 · feat(setnayan-ai): studio page lists everything the AI keeps for the event — live figures when active, honest pitch when not

Owner note (2026-07-21): "Setnayan AI does not list all the information they provide for this event. Show the value of what they save and what service is practically impossible for a person to keep for them."

The studio Setnayan AI page (`/dashboard/[eventId]/studio/setnayan-ai`) ACTIVE state showed a single line — "Your vendor shortlist is ranked" — and a link to `/vendors`. It never surfaced the breadth of what the assistant is continuously doing: matchmaking, deadline tracking, payment-due + over-budget guards, quiet-vendor chasing, eyeing-your-date alerts. This closes that.

**State-aware surface (owner design, 2026-07-21):**

- **ACTIVE → live per-event figures.** New `SetnayanAiValue mode="live"` leads with the Decision Cockpit briefing ("You're 62% locked in, 3 decisions need you, next deadline in 5 days") + a progress bar, then a 3-group capability list (Finds the right people · Keeps it all moving · Guards against costly slips) where each row is annotated with a REAL figure — % locked + vendors on board, deadlines on watch, decisions waiting, payments due in 30 days — closing with the "impossible to keep by hand" value line.
- **PAUSED / BUY → static pitch.** Same honest capability list described as what the assistant WILL keep for you, no live numbers. Replaces the old 3-tile `WHAT_YOU_GET` grid on the buy screen; the price/checkout tile is untouched.

**Honesty rule (owner "no fake doors").** Every listed capability is WIRED and running — verified against `setnayan-ai-snapshot.ts` sourced inputs (payment-due, over-budget, statutory, vendor-quiet), the matchmaking gate (`setnayan-ai.ts`: ranked % match, reception-proximity, best-match auto-inquiry, eyeing-your-date) and their call sites (`vendors/page.tsx`, `unlock-category.ts`). Designed-but-dormant guards with no live data source — price-drop (GRD-03), availability-change (GRD-09), contract-window (GRD-07), the consent-gated Inference/Trend categories — are deliberately absent from the list and NOT counted.

**Implementation.**

- `lib/setnayan-ai-activity.ts` (new) — `loadAiActivity()`, a thin, fully fail-soft orchestrator over already-proven pure libs (`buildCockpitModel`, `pickTodaysOneThing`/`countUnlockedCategories`, `fetchUpcomingItems`, paperwork helpers). Invents no business logic; reuses the exact derivation the couple Overview runs, so the figures can't drift from the dashboard. Event fields are passed in (the page already fetched the event row) → no second `events` query. Plus four pure, exported figure formatters.
- `.../studio/setnayan-ai/_components/setnayan-ai-value.tsx` (new) — one server component rendering both modes from a single honest capability catalog.
- `.../studio/setnayan-ai/page.tsx` — widened the event select, loads activity only in the ACTIVE branch, renders the surface across all three states.

Tests — new `lib/setnayan-ai-activity.test.ts` (4 cases: pluralization + reassuring zero-states for every live figure). Full unit suite green (2501), typecheck + lint + entitlement-gates/legibility/masthead/retired-strings/nested-forms guards clean.

Follow-up flagged to owner (not in this PR): the public marketing page `app/setnayan-ai/page.tsx` claims "price changes" and "availability" watching that `setnayan-ai-snapshot.ts` marks as not-yet-wired — a separate over-claim to reconcile.

SPEC IMPACT: None — surfaces existing, wired capabilities honestly; no new SKU, price, entitlement or schema change.
