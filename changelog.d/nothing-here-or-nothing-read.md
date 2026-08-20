## 2026-08-19 · fix(account): three pages stop reporting an absence they never measured

| page | what it said |
|---|---|
| Your year | "Nothing on your calendar yet." |
| Your chapters | "Your chapters (0)" |
| Profile → Featured | "Nothing here — when you allow a creation to be featured…" |

All three were computed from a read whose failure degraded to an empty list.
**Two of them already BOUND the error and logged it**, which is the whole point:

🔑 A LOG LINE NEVER CHANGED A PIXEL. Binding is not fixing.

⚠ THE FEATURED ONE IS THE WORST AND IT IS NOT OBVIOUS WHY. Those rows are
CONSENTS the person granted, and that block is where they go to **revoke** one —
so a false "nothing here" does not merely misinform, **it removes the control.**
Same shape as a guest list that hides the guests: the absence takes the actions
with it.

Each now says it could not load, and — asserted separately — each KEEPS its
genuine empty state for the person who really has none. Replacing the honest
sentence everywhere would be the opposite defect.

SPEC IMPACT: None.
