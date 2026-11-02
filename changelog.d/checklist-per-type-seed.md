## 2026-07-08 · feat(checklist): seed the correct per-type checklist for non-wedding events

Completes the non-wedding fix. PR-0 stopped seeding the wrong (wedding)
checklist for non-wedding events by seeding nothing; this seeds the RIGHT
per-type template instead.

- `buildSeedRows(eventId, template, ceremonyType)` extracted from
  `buildChecklistSeed` — the generic mapper for any `ChecklistTemplateItem[]`.
  `buildChecklistSeed` now delegates to it, so the wedding seed is byte-identical
  (proven by a test asserting equality across all ceremony types).
- `ensureChecklistSeeded` resolves `checklistDefForEventType(event_type)`: wedding
  /unset → the canonical wedding template (unchanged); an enabled non-wedding type
  (birthday, debut, christening, …) → its own per-type template; an unknown
  non-wedding type → seeds nothing.

No wedding regresses (byte-identical). No schema change.

SPEC IMPACT: PR-2/PR-3 of
`02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md`. Corpus current.
