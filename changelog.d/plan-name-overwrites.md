# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · fix(vendors): a plan name means one plan, and a converged build says what it costs you

Two owner rulings from one session at the Explore/Marketplace surface, both about the page
telling the couple the truth about a consequence it had already computed.

### 1 · Saving a plan under an existing name now OVERWRITES it

Owner, after trying it in the playable prototype: *"i tried saving 2 plans with the same name …
it should not be allowed. it should overwrite the plan."*

`planSaveAs` (`lib/named-builds.ts`) received `existing` and **never compared the name against
it** — the rows were fetched, passed in, and read only to resolve an explicit `overwriteBuildId`.
With no id, a duplicate name fell through to `{ mode: 'create' }`. Saving "Plan B" twice produced
two `budget_builds` rows both titled "Plan B", Compare rendered two indistinguishable columns, and
Load resolved by `build_id` — a value the couple cannot see.

🔑 **The data to prevent it was already in the function.** This is not a missing lookup; it is a
fetched-and-ignored one, which is why nothing errored and no test caught it.

Now: no target + a name already held by a named build → overwrite THAT build. Four rules, each
tested:

- **Case- and whitespace-insensitive** — both sides run through `normalizeBuildTitle`, so
  "garden classic" re-saves over "Garden Classic". Requiring matching capitalization to overwrite
  is the same bug wearing a different hat.
- **A blank name never matches.** It normalizes to `null` = "auto-title me"; two untitled builds
  are legitimately distinct ("Build 1", "Build 2"), so a null title always creates.
- **Legacy A/B/C rows (`label !== null`) are never matched** — they are fixed slots, not named
  builds. Typing "Plan A" must not silently overwrite the historical A column.
- **Pre-existing duplicates resolve deterministically** via `sortSavedBuilds` order, so a name
  maps to the same build regardless of the order the DB returns rows in.

An explicit `overwriteBuildId` still wins over a name match; the stale-id fail-soft-to-create path
is unchanged.

### 2 · A converged date banner now states the CONSEQUENCE, not just the constraint

Owner: *"if a date is picked based from the combination of vendors, then we should say that
picking these vendors will lock your date on XXX."*

`convergenceBanner` (`lib/build-date-window.ts`) already detected the one-day case and said
**"Only Sep 26 works for everyone"** — a fact about the calendar that left the couple to work out
for themselves that proceeding with this build decides their wedding date. The headline now leads
with the consequence: **"Locking these vendors sets your date: Sep 26"**.

⚠ **Rule 3 of that module still holds and is now guarded.** The soft tier promises NOTHING about
reservations. "Sets your date" is true of the EVENT's date — the same fact the lock modal already
states as *"This lock sets your date"* — and is not a claim that the day is held with the vendor.
The detail keeps *"Nothing is held yet — your date is reserved only once a vendor accepts your
payment"*, and the test now fails if the copy ever grows a phrase implying a hold.

### Tests

Six new cases in `named-builds.test.ts`; the converged-banner case in `build-date-window.test.ts`
**re-anchored, not relaxed** — it still asserts the no-reservation rule and now also asserts that
the headline carries BOTH the consequence and the day.

Mutation-checked in both directions: disabling the name-match branch turns 3 of the 6 new cases
RED (the other 3 are non-regression guards that must hold either way); reverting the headline to
the old wording turns the banner case RED. Restored, all green — `named-builds` 22/22,
`build-date-window` 34/34, adjacent `plans-panel` + `your-team` suites 51/51 combined.

SPEC IMPACT: two DECISION_LOG rows (2026-09-06) — the plan-name uniqueness rule, and the converged
banner's consequence-first copy with its no-reservation constraint. No SKU, price, schema or
migration change.
