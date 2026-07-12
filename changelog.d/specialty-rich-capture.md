# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(onboarding): capture the rich per-type specialty fields (Track-B slice 2)

Slice 1 landed the specialty catalog as data (PR #3179). This wires it into the generic `/onboarding/[type]` flow so the rich per-type "signature fields" are actually captured and persisted — the debut 18 Roses/Candles/Treasures + court, christening ninong/ninang, the anniversary retrospective, milestone-as-data, etc. Until now the generic flow could only render single-select tiles.

- **`app/onboarding/[type]/_components/specialty-fields.tsx`** (new) — a controlled `SpecialtyFields` component that renders the catalog's fields across the FULL field-type vocabulary the tile flow lacked: `text` · `textarea` · `date` · `number` · `boolean` (Yes/No) · `select` (single chip) · `multiselect` (fixed chips OR an open type-and-Enter tag input) · `person_roster` / `list` (repeatable rows with item-fields — **UNCAPPED**, per the catalog's #1 cultural rule: never hard-cap the sponsors / the 18s / the court). Brand-consistent styling (mulberry chips, paper inputs).
- **`app/onboarding/[type]/_components/generic-onboarding.tsx`** (surgical wiring) — reads `getSpecialtyFields(eventType)`; when the type has catalog fields, injects one optional `specialty` screen after the tq_ questions; new `specialtyValues` state (drafted to localStorage like the rest); merges it into the commit payload's `signatureDetails` (`{ ...details, ...specialtyValues }`) → `events.signature_details`, read by the Event Brief's specialty layer (#3144). Types with no catalog entry render no extra screen — the flow stays byte-identical.

No schema change (the `signature_details` column landed in #3144). Live behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` (already on). Every field is optional (the screen is skippable). Built FROM the parallel session's culture catalog, coordinated — not a fork.

Follow-on: rite-conditional field reveal (show_when), and per-type polish/Tagalog-label passes as the catalog evolves.

Verified: `tsc --noEmit` clean; catalog suite 7/7. Live render is best eyeballed on the Vercel preview (the `/onboarding/[type]` route is flag-gated by `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED`, already on in prod) — CI's production build + preview deploy exercise it.

SPEC IMPACT: The rich per-type onboarding now captures + persists its signature fields end-to-end (catalog → render → signature_details → Brief). No pricing/schema-of-record change. See `Event_Onboarding_Signals_All_Types_2026-07-12.md`.
