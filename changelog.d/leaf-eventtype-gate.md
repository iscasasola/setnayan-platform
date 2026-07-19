## 2026-07-08 · fix(checklist): leaf-suggestion event-type gate + planned-exclusion

Closes audit gaps #3 and #4 in the leaf "you might also want" suggestions.

- **#4 (correctness):** `applicable_event_types` is unseeded in the DB, so the
  event-type gate treated every leaf as "all types" — a birthday could be
  suggested wedding-only services (e.g. a coordinator). Now an UNTAGGED leaf
  defaults to WEDDING-ONLY (the taxonomy is wedding-first); an admin tags a leaf
  to opt it into other event types. Weddings are unaffected (untagged leaves
  still apply); non-weddings get no suggestions until leaves are tagged — "no
  suggestions" beats "wrong suggestions".
- **#3 (exclusion):** the already-planned exclusion compared `interested_categories`
  (picker/plan-group vocab) against taxonomy `tileId`s — mismatched, so it never
  matched. Now maps picker key → PICK_TO_GROUP → PLAN_GROUPS.catalogTile → tile,
  so a couple isn't re-suggested a category they already picked. Best-effort: an
  unmapped pick simply excludes nothing (never a wrong exclusion).

Pure gate change is unit-tested (untagged → wedding-only, both directions). No
schema change.

SPEC IMPACT: closes gaps #3 + #4 from the 2026-07-08 Adaptive Checklist audit.
Follow-up (owner/admin): seed `applicable_event_types` per event type via
/admin/event-types to light up non-wedding leaf suggestions.
