## 2026-07-12 · feat(create-event): optional date / guests / budget on the non-wedding create form

Owner decision (2026-07-12): RELAX the locked "single-field, name-only" event creation (iteration 0000 §2.5) for the non-wedding inline path — the couple can optionally seed their timing + guest count + budget so the Event Brief (and, once anchored, the checklist + budget-health) have real signal. All fields OPTIONAL; name-only creation still works; weddings are unchanged (they use the wizard's date model).

**Date model matches the platform, not a single locked date** (owner: "we used to give them up to 4 dates or a range"): a compact `CreateDatePicker` offers **specific — up to 4 candidate dates**, OR **a range** → persisted to `date_mode` / `date_candidates` / `date_window_start/end`. `events.event_date` stays NULL — the locked single date is chosen later (date-as-output; the date-selection lock ceremony). Budget-band × guest count → `estimated_budget_centavos` (per-head median × pax × 100).

Pure `resolveCreateCapture` (`lib/create-event-capture.ts`, 14 unit tests) validates everything and fails closed: guest count capped at the DB ceiling (**< 10 000**, matching the `events_estimated_pax_check`), **past dates rejected** (no planning behind today — also avoids anchoring a fresh event into recap/day-of mode), candidates deduped/sorted/capped at 4, window clamped to 30 days inclusive, legacy `nolimit` → `no_limit`. Threaded via `page.tsx` (getBudgetBands) → `EventTypePicker` → the action.

Adversarially reviewed (CHECK-constraints · downstream-event_date · regression); the confirmed findings (pax ceiling > DB CHECK; unbounded past dates) are fixed here.

SPEC IMPACT: Reverses the iteration-0000 §2.5 single-field-creation lock for the non-wedding path (owner-authorized 2026-07-12). Logged in DECISION_LOG.md. FOLLOW-UP (surfaced, not built): to light up the checklist's date-anchored *deadlines* from these tentative dates, the checklist must anchor on the best-known date (event_date → candidate[0] → window_start) — which also gives weddings tentative deadlines; that's a separate decision.
