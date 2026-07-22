## 2026-07-22 · fix(events): Date/Hangout checklist chrome (were rendering as "Wedding checklist")

A systematic sweep of every `event_type` touchpoint (done to build a "adding a new event type" checklist) caught a live bug from the Date/Hangout registration (#3499): neither was in `CHECKLIST_EVENT_LABELS` (`lib/checklist.ts`), so `checklistChrome()` fell them through the `!CHECKLIST_EVENT_LABELS[eventType]` guard to the **Wedding** chrome — a Date or Hangout event showed "Wedding checklist", "Your wedding", an 18-months-out intro. The guardrail `checklist-event-labels.test.ts` didn't catch it because it derives its roster from `ANCHOR_BY_TYPE`, which *also* lacked the two types.

Fix:
- `lib/checklist.ts` — add `date` → {noun:'date', title:'Date'} and `hangout` → {noun:'hangout', title:'Hangout'} to `CHECKLIST_EVENT_LABELS`.
- `lib/event-anchor.ts` — add both to `ANCHOR_BY_TYPE` (`fixed_date`/`input`, same as the FALLBACK they were already getting) so they carry explicit anchor semantics AND the checklist-labels guardrail now covers them.
- `lib/event-anchor.test.ts` — expected-keys roster 14 → 16.

Both guardrails now guard Date/Hangout (delete either label and the test fails). Typecheck + lint + build clean; full suite green (2571).

SPEC IMPACT: None (label/config fix). Companion: the corpus now has `Adding_A_New_Event_Type_Checklist_2026-07-22.md` — the full classified touchpoint inventory (REQUIRED / RECOMMENDED / FEATURE-GATE / DO-NOT-TOUCH) so future type additions have a net.
