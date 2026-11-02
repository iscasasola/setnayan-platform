## 2026-08-28 · fix(vendors): say so when we ranked a couple's shops on a budget they never set

Follow-on to S5 (`price-decides-reach`, PR #4954), and it closes a hole that PR
opened: the band-derived budget moves the **second-largest dimension of the match
%** (`budgetFit`, weight 0.20, computed on every search), so a couple who picked
a budget feel and never typed a figure is now ranked against a number — and
nothing on screen said so, or offered a way to replace it.

**A field with no reader is the shape this repo keeps paying for.** `budgetSource`
shipped in #4954 with **zero readers outside its own guard**. It has one now.

**What a person sees.** Above the results, where the "raise your budget" nudge
already lives: *"We're matching on an estimate — you chose **Classic** for about
150 guests, so we're working from around ₱900,000 for the whole celebration. Put
in your own figure and these results follow it."* with **Set your budget**.

- It appears **only when the estimate actually decided something for this
  category** — an estimate that resolved no leaf here changed nothing, and saying
  otherwise would be a lie about the couple's own money.
- It is **not behind `NEXT_PUBLIC_SMART_SORT_ENABLED`**, because the estimate is
  not either. A notice hidden behind a switch the ranking ignores would leave
  most couples ranked on a number nothing on screen mentions.
- It **suppresses** the raise-your-budget nudge. Telling somebody to raise a
  budget they never set is nonsense, and two stacked banners over one list is
  noise.

**Measured** · typecheck 0 errors (exit 0) · 10,941 unit pass · 5 mutations, each
measured by occurrence count before → after, all RED.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 (appended to the S5 row's stream).
