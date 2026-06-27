## 2026-06-28 · fix(weddings): wire `chinese` ceremony_type through the resolve layer (close the active-but-empty dead-end) + enrich the Chinese traditions guide

Couples could pick **Chinese** in the ceremony-type picker (it's a valid,
`active` `ceremony_type` in prod — migrations `20260804000000` +
`20260806000000` widened the CHECK + flipped launch-status), but the TypeScript
layer never learned the value: `CeremonyType` and `resolveCeremonyType()` only
knew 15 types, so a stored `ceremony_type='chinese'` silently resolved to
`'unknown'`. The couple then saw the generic "pick your ceremony type" empty
state on `/paperwork` **even though `WEDDING_TRADITIONS_GUIDE['chinese']` already
existed**. The content was there; the resolver dropped it on the floor. This is
the code-level form of the 2026-06-11 taxonomy audit's "Chinese is an
active-but-empty dead-end" finding.

**No migration** — the DB already accepts and activates `chinese`; this is a
pure code-wiring fix, deploy-safe.

- `lib/paperwork.ts` — add `'chinese'` to the `CeremonyType` union + the
  `resolveCeremonyType()` allow-chain; add a `chinese` entry to
  `DOCUMENTS_BY_CEREMONY_TYPE` (universal PH base — PSA + CENOMAR + Marriage
  License; the legal marriage rides the paired church/civil rite).
- `app/dashboard/[eventId]/paperwork/page.tsx` — `ceremonyLabel()` now returns
  "Chinese" instead of falling through to "Filipino".
- `lib/wedding-traditions.ts` — enriched the `chinese` guide from the new
  reference doc: tea ceremony (敬茶, with the groom's-side-first serving order),
  auspicious date now names the BaZi / Four-Pillars birth-date-**and-time**
  reading + favour-8/avoid-4 + Ghost Month, betrothal gifts (過大禮), plus two
  new signature rites — hair-combing (上頭) and bridal-bed setup (安床) — and
  attire/symbols (qun kua + 囍) and the no-table-4 lauriat note. Stale
  "Chinese is coming-soon" comment corrected (it's active).
- `lib/auspicious-date.ts` + `app/dashboard/[eventId]/date-selection/{actions,page}.tsx`
  — add `'chinese'` to the union + both `CEREMONY_TYPES` lists so Chinese
  couples flow through the date-selection / auspicious-date reasoning (which
  already surfaces number-8 + Chinese-zodiac numerology to every couple — not
  duplicated here).

Known follow-up (tracked, not fixed here): `CeremonyType` is defined **four
times** (`paperwork`, `auspicious-date`, `wedding-plan-groups`, `admin/venues`)
— duplicate-union drift. This PR makes Chinese first-class in the two
couple-facing subsystems that define "does a Chinese wedding work" (paperwork +
date); `wedding-plan-groups` planning-group hints and the venues constant still
omit `chinese`. Consolidating to one shared `CeremonyType` is the real
root-cause and is logged for a dedicated refactor PR. `jewish` / `born_again`
are offered by the picker but are NOT in the DB CHECK — a separate pre-existing
gap, untouched here.

Typecheck clean (`tsc --noEmit`, exit 0).

SPEC IMPACT: Implements the overlay model locked 2026-06-28 in
`Chinese_Wedding_Traditions_Reference_2026-06-28.md` (Chinese = a tradition
layer on a primary rite). Corpus already updated directly (reference doc + two
new Concierge chunks in `09_Date_Selection_Cultural_Logic.md` + DECISION_LOG.md
rows) per the standing direct-edit authorization. No further spec edit needed
for this PR.
