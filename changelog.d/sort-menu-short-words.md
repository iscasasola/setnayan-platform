## 2026-10-30 · fix(suppliers): the sort menu's rows say one short thing each

Owner, 30 Oct, on the Suppliers › Find "Best matches" ▾: *"this dropdown's list has too much wording per row. the
Nearest Loc, Budget Fit, New Suppliers"*. On a phone each greyed row wrapped to four or five lines.

- The three ranking choices are renamed **Nearest** · **Budget fit** · **New suppliers** (were "Nearest to your venue" ·
  "Fits your budget" · "New here"), and the note beside a greyed one is a few words: "Add your venue first" · "Set a
  budget first" · "None here yet". Same rows, same rules for when each is offered (`lib/ranking-lenses.ts`); the
  Explore page's lens chips read the same labels.
- Unchanged on purpose: the reason pills on each supplier card ("Fits your budget", "Nearest to your venue"), and
  "In demand right now" — the public privacy notice names that one by its words.

SPEC IMPACT: None — wording of an existing menu.
