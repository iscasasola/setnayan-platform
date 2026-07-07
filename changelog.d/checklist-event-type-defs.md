## 2026-07-08 · feat(checklist): per-event-type definition library (inert)

Adds `lib/checklist-event-type-defs.ts` — the de-hardcode substrate for the
adaptive checklist. Defines `EventTypeChecklistDef` (dateModel · anchorCategory ·
tier2Core · template) and per-type performable-task templates for the 8 enabled
non-wedding types: debut, birthday, christening, corporate, tournament,
gender_reveal, travel, celebration. `checklistDefForEventType()` returns `null`
for wedding/unset so the caller keeps using the canonical wedding
`CHECKLIST_TEMPLATE` (live wedding checklist unchanged).

- Same `ChecklistTemplateItem[]` shape as the wedding template → the seeder can
  consume it identically when wired.
- `dateModel` marks christening (parish-scheduled) as `output` and the rest as
  `input` (date chosen up front).
- Unit-tested: resolver fallback, global key uniqueness, valid categories.

**Inert on landing** — no importers yet; PR-2/PR-3 wire it into the seeder.

SPEC IMPACT: Implements lane C of
`02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md` (§5 type defs).
Corpus already carries the definitions.
