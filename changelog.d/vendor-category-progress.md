## 2026-07-08 · feat(checklist): vendor progress states on the checklist

Wires the merged `resolveCategoryState` machine (previously dead) into the
checklist: a "Vendor progress" card resolves the couple's shortlisted/booked
vendors to a live state per category ("comparing options", "one option found",
"in progress", "confirmed") — so the plan reads as decisions in motion, not a
flat list. Completes the "printable list → execution engine" turn alongside the
budget health-check and leaf suggestions.

- `lib/vendor-category-progress.ts` (pure, unit-tested): groups event_vendors by
  category, resolves each via `resolveCategoryState`, drops untouched ones,
  orders attention-first.
- `checklist/page.tsx` fetches event_vendors (defensive) and passes progress to
  `ChecklistFull`, which renders the pill card — only when a vendor is engaged.

Additive + null-safe: no card without vendors or on any read error. No schema
change.

SPEC IMPACT: PR-1b of `02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md`.
Corpus current.
