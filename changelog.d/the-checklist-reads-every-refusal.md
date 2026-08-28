## 2026-08-28 · fix(admin-map): the operator checklist reads every refusal, not one spelling of one

`refusedWhenEmpty` tells an operator which fields a job will not run without. It
was derived from ONE binding shape, so it saw **195 of ~415 bindings — under
half**. Every job binding a field any other way was published as refusing
**nothing**: `refundOrder` demands a 20-character reason so the couple has a
paper trail, and the checklist said it needed none.

- Bindings are now matched by SHAPE (`const x = <anything>formData.get('k')`),
  never by a list of wrapper names that would need paying forever.
- The emptiness test must now reach an actual refusal — this admin says no six
  ways, and all six are matched.

**75 → 108 entries: +41 real refusals that were invisible, −5 verified false
positives** (an `x === '' ? null : x` ternary means empty is LEGAL, so retiring
a price row genuinely needs no reason).

SPEC IMPACT: None.
