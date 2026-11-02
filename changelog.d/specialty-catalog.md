# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(onboarding): land the per-type specialty catalog (Track-B data layer)

The rich per-type onboarding (Track B) — the culturally-grounded "signature fields" each event type captures beyond the generic core (the debut "18s", christening ninong/ninang, the anniversary retrospective, milestone-as-data) — was fully designed in the event-specialty design workflow but had no code representation. This lands that catalog as one typed, validated source of truth, so every downstream Track-B PR (the rich renderer field-kinds, the persistence wiring, per-type consumption) reads from a single place.

- **`apps/web/lib/onboarding/specialty-catalog.ts`** — `SPECIALTY_CATALOG` keyed by `event_type` for all **14 types** (108 signature fields, 12 person-rosters), plus the `SpecialtyFieldType` vocabulary (`text · textarea · date · select · multiselect · boolean · number · person_roster · list`), the `SpecialtySpec`/`SpecialtyField` types, and pure loaders `getSpecialtySpec` / `getSpecialtyFields`. Customer-facing Tagalog `terminology` + a `the_hook`/`avoid` per type; snake_case English `key`s as the stable schema. Data only — no renderer/persistence change.
- **`apps/web/lib/onboarding/specialty-catalog.test.ts`** — 7 invariants: 14 types keyed by `type`; required copy present; every field snake_case + typed in the vocabulary + no dup keys; select/multiselect carry an `options[]`; person_roster/list carry non-empty `item_fields`; the load-bearing rosters (wedding sponsors · christening godparents · debut 18s) exist (build-note #1: never hard-cap); loaders resolve.

This is the DATA foundation. It complements the already-merged specialty *persistence* layer (PR #3144: `events.signature_details` + the Event Brief `specialty` layer). Follow-on PRs: (2) extend the onboarding renderer/spec beyond single-select tiles to the new field-kinds (esp. multiselect/number/person_roster + rite-conditional reveal), (3) wire per-type capture → `signature_details`, richest types first (debut → christening → anniversary). Coordinated with the parallel event-specialty workstream that authored the catalog.

Verified: `tsc --noEmit` clean; catalog suite 7/7.

SPEC IMPACT: Adds the per-type signature-field catalog (design → code) that the rich onboarding + deterministic engines will read. No pricing/schema-of-record change (schema landed in #3144). See `Event_Onboarding_Signals_All_Types_2026-07-12.md` + memory `project_setnayan_event_onboarding_signals`.
