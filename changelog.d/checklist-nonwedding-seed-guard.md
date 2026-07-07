## 2026-07-08 · fix(checklist): don't seed the wedding checklist for non-wedding events

`ensureChecklistSeeded` seeded the entirely wedding-shaped `CHECKLIST_TEMPLATE`
for every event regardless of `event_type`, so a birthday/debut/christening
rendered a full Catholic-wedding checklist (marriage license, pre-Cana,
ninong/ninang) — the `isChurchCeremony(null) === true` default meant a null
`ceremony_type` fell into the church path.

- New `isWeddingEvent(eventType)` helper: null/unset or `'wedding'` → wedding
  (backward-compat for events created before `event_type` was populated; mirrors
  the "don't hide guidance prematurely" precedent). Explicit non-wedding types
  are excluded.
- `ensureChecklistSeeded` now reads `event_type` and returns early (seeds
  nothing) for non-wedding events, rather than inserting the wrong list. Per-type
  templates land in a follow-up; blank is correct until then.
- Unit test covers the 8 enabled non-wedding types + the null/wedding pass-through.

No wedding regresses (null/`'wedding'` still seed the full list). No schema change.

SPEC IMPACT: Aligns with `02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md`
PR-0 (the live null-ceremony correctness fix). Corpus already updated.
