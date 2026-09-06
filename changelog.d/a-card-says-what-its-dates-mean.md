# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · feat(bench): a card says what its dates mean, and hides the long tail behind a popup

Two owner rulings: *"i also need to know what if the vendor has multiple dates available for them"*,
then *"if there are more than 4 dates available, we can control what shows and make a small popup to
show their dates."*

### The defect this closes

A card showed `Free: Sep 12 · Sep 26` and nothing about what locking that vendor would DO. The
couple had to infer it. Worse, the binding prototype answers the question **wrongly** — every card
there carries a hardcoded `note` fixture string, so The Glasshouse Alta (free Sep 12 AND Sep 26)
claims *"Sets your date to Sat · Sep 12"* because a fixture author picked one by hand, and its
`doLock` then hardcodes `2027-09-12` for ANY reception lock — locking a venue free only in October
would have set the wedding to September. **A port of the prototype would have shipped that.**

### The rule, mirrored not re-invented

`actions.ts` gates the wedding date on **`viable.length === 1`** — "date-as-output, force-to-one". A
vendor free on several days does NOT set the date; locking them narrows the candidates, and the date
settles only when the intersection across every locked vendor collapses to one day.

`dateOutcome` enforces exactly that, and the card now says one of:

- **`Locking this sets your date to Sat · Sep 12, 2027`** — only ever for a SINGLE viable day
- **`Leaves 2 possible dates — your date is not set yet`**
- nothing at all, when the date is already anchored, when there is no overlap (the amber clash badge
  says it better), or when there is no calendar signal

### The inline cap + the popup

`freeDaysLine` already truncates at three and returns **one string**, so its "+2 more" could never be
a button. `cardDates` returns the PARTS instead: up to **four** named inline (the owner's number),
the overflow count, and the complete list for the popup. `freeDaysLine` is untouched — other callers
depend on it.

The overflow trigger `preventDefault` + `stopPropagation`s: the card is an `InspectorTrigger`, so
without both the press would follow the card link and open the vendor's quick-view behind the popup.

### One window, one classifier

The outcome is resolved once per render against the SAME `buildWindow` the convergence banner and
the bench's sink are drawn from. Deriving a second window inside the card would be a copy of the
intersection, free to drift from the two surfaces already drawn from it.

### Plumbing

`ShortlistVendor` gains `freeDays` — the raw days `freeDaysLine` was already formatted from. The
page already held the map; it just collapsed it to a string before the card could see it. Additive:
the existing `freeDaysLine` still renders when there is no structured view.

### Tests

17 in `card-dates.test.ts` — 12 pure, 5 source-anchored. Mutation-checked, each red on its own case:
letting two viable days claim they SET the date · raising the inline cap past four · the popup
rendering the truncated slice · dropping `stopPropagation` · wiring only one of the two rails.

🪤 The last source guard's first draft failed on **its own docblock** — it asserted the component
never says "sets your date", and the docblock explaining that rule contains the phrase. It now reads
`stripComments(...)`: a guard that reads prose is measuring the wrong thing.

148 green across the six adjacent suites.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 — a card may claim the date only for a single viable day
(mirroring `viable.length === 1`), and names at most four dates inline. No schema, SKU or price
change.
