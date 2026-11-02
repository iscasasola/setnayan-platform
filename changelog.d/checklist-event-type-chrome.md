## 2026-07-08 · fix(checklist): event-type-aware chrome + clickable per-type tasks

Closes two gaps where the per-type checklist data (shipped earlier) was still
wrapped in wedding presentation:

- **Chrome:** `checklistChrome(eventType)` drives the page title, H1, eyebrow,
  intro copy, the "add a date" hint, and the day-of phase label. A birthday now
  reads "Birthday checklist / Your birthday", not "Wedding checklist". Wedding
  (and null/unknown) returns the EXACT original wedding copy — the live wedding
  checklist is byte-identical (asserted by test). Wedding-flavored phase blurbs
  are suppressed for non-wedding types.
- **Deep-links:** `checklistItemHref` gains a category fallback scoped to the
  per-type key prefixes (debut_/bday_/christ_/…), so a non-wedding task is a
  clickable decision (→ vendors / guests / budget / mood board / schedule /
  paperwork) instead of a dead checkbox. Wedding keys are all explicitly mapped,
  so passing category never changes a wedding href.

Also converts the page to `generateMetadata` for a per-type tab title, and
passes category through the home "Up next" card links.

No schema change. Tests: chrome copy (wedding byte-identical + non-wedding
variants), href fallback, wedding href regression.

SPEC IMPACT: closes gaps #1 (wedding chrome) + #2 (per-type tasks not clickable)
from the 2026-07-08 self-audit of the Adaptive Checklist build.
