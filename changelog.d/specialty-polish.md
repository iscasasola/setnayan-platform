# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · fix(onboarding): normalise + conditional-reveal for rich specialty capture (Track-B polish)

Closes the gaps found auditing the rich per-type capture (slices 1–2, #3179/#3182): raw form values were persisted stringy and empty-keyed, and the catalog's rite-branching had no code path.

- **`lib/onboarding/specialty-values.ts`** (new, pure) — `normalizeSpecialtyValues(fields, values)` cleans the bag before it hits `events.signature_details`: **number fields → real numbers** (the renderer holds them as strings while typing; e.g. a rose's `dance_order` now persists `3`, not `"3"`), roster cells coerced by their declared type, **empty values + empty roster rows dropped**, and **`show_when`-hidden fields excluded**. Plus `isSpecialtyFieldVisible(field, values)` — the conditional-reveal predicate (a controlling `select` string OR a `multiselect` array intersection).
- **`lib/onboarding/specialty-values.test.ts`** (new) — 8 invariants: number coercion, text/date/boolean trim+keep rules, multiselect density, roster cell-coercion + empty-row drop, purity/idempotence + no-mutation, and `show_when` visibility (drops a hidden field's value too). This also closes the "no `SpecialtyFields` logic test" gap.
- **`lib/onboarding/specialty-catalog.ts`** — adds optional `show_when?: { field; equals[] }` to `SpecialtyField` (rite branching: show unity rites only for religious ceremonies). Additive/backward-compat; no existing entry uses it yet, so the renderer is byte-identical until the catalog encodes a condition.
- **`specialty-fields.tsx`** — filters fields through `isSpecialtyFieldVisible` (hidden fields don't render).
- **`generic-onboarding.tsx`** — applies `normalizeSpecialtyValues(specialtyFields, specialtyValues)` when building the commit payload's `signatureDetails`.

No schema change. Behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED`.

Still open (flagged, not in scope here — larger / parallel-owned): the captured specialty data is **not yet consumed** by any output engine (highest-value next work), and the cross-cutting capabilities (surprise-mode / funding-mode / program-as-object; recurrence + people-layer are owned by the event-anchor workstream).

Verified: `tsc --noEmit` clean; specialty-values 8/8 + specialty-catalog 7/7.

SPEC IMPACT: Persistence-quality fix — `signature_details` now holds typed, dense, condition-aware data. No pricing/schema-of-record change. See `Event_Onboarding_Signals_All_Types_2026-07-12.md`.
