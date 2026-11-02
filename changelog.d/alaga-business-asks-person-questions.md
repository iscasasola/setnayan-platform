# fix(alaga): a business no longer asks for relationship, debut year, religion

## 2026-08-20 · fix(alaga): the add-form hides person-only questions for non-person kinds

Choosing "A business" (or a pet / something I own / something else) on the Add
an alaga form still showed Relationship, "For the debut year" and Religion —
three questions `addDependent` nulls for every non-person kind, so the answers
were silently discarded. The form was fully server-rendered, so the kind
selector could not hide anything.

- The add-form's fields moved into a client component (`add-alaga-fields.tsx`)
  keyed on the chosen kind: a non-person kind is now name + one optional date,
  labelled per kind (founding date · the day it became yours · the date that
  matters) via the existing `DEPENDENT_DATE_LABELS` vocabulary.
- Person keeps all fields and the child/elder birthday rule text; nothing about
  what is SAVED changed — the server action already enforced this boundary.

SPEC IMPACT: None
