## 2026-07-21 · fix(checklist): event-type labels for the 5 types enabled by "enable them all"

`CHECKLIST_EVENT_LABELS` (`apps/web/lib/checklist.ts`) carried 9 of the 14
`event_type_vocab` types. `checklistChrome()` falls back to the verbatim wedding
copy for any key it does not recognise, so **anniversary · graduation · reunion ·
gala_night · simple_event** each seeded a real, fully-populated checklist (the
generic `CELEBRATION_TEMPLATE`, via `GENERIC_EVENT_CHECKLIST_DEF`) and then
rendered it under **"Wedding checklist" / "Your wedding"** with the 18-months-out
wedding intro — including the `<title>` from `generateMetadata`.

The gap opened when migration `20270726622326_enable_all_event_types.sql`
("enable them all", owner 2026-07-11) flipped anniversary/graduation/reunion/
gala_night to `enabled=TRUE`, and `20270307127948` added `simple_event`; the
label map was never extended to match.

- Added the five missing entries with correct noun + Title-case title. Nouns
  match the `event_type_profiles.terminology.event_word` already seeded in
  `20270731100000`, so the checklist chrome now agrees with the rest of the
  dashboard.
- New guardrail suite `apps/web/lib/checklist-event-labels.test.ts`. The
  load-bearing half is import-driven (every key in `EVENT_TYPE_CHECKLIST_DEFS`
  must resolve to non-wedding chrome) and can never go stale; the second half
  hand-lists the 14 vocab keys and carries an in-file comment stating that
  weakness honestly (the roster lives in Postgres — there is no TS constant to
  import, and `EVENT_TYPES_FALLBACK` is a frozen fail-open list, not the roster).
- The unknown-key fall-through is **unchanged** — a typo or a runtime
  admin-created type still renders wedding chrome, which stays the safe default.
  No migration, no schema change, no per-type checklist templates.

**User-visible:** existing anniversary/graduation/reunion/gala_night/simple_event
events will see their checklist heading and page title change from "Wedding
checklist" to the correct wording on next render.

SPEC IMPACT: None — this restores the intended behaviour of already-locked
specs (per-type checklist chrome shipped with the non-wedding event types). No
SKU, price, schema, or decision change.
