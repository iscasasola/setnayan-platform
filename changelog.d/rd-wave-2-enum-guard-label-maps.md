## 2026-09-22 · fix(guard): the enum-literal scan can tell a label map from a write

`enum-literals-are-real.db.test.ts` matches `<column>: '<value>'` across every file under
`app/` and `lib/`, and reported the guest-card autosave as writing an illegal
`rsvp_status='RSVP'`. It does not. The match is inside

```ts
const FIELD_LABELS: Record<string, string> = { rsvp_status: 'RSVP', meal_preference: 'Meal', … };
```

— a display-label map read once, to name a field in the undo snackbar. **A label map inverts
the relationship the matcher assumes: the KEY is the column and the VALUE is prose for a
human.** Textually it is indistinguishable from an insert payload; in substance it never
reaches Postgres.

🔑 The alternative was to contort the label map so the matcher would not see it. That is the
failure this project keeps paying for — **a scanner that cannot read the correct pattern
punishes the correct code and rewards the copy** — and it is the same fix, in the same
direction, as the select-column scanner's re-export resolver earlier today.

**The carve-out is narrow and it is bounded in BOTH directions.** The declared type must be
exactly `Record<string, string>` and the identifier must end in `_LABELS`; a write payload is
neither. A floor asserts the stripper still removes something, so it cannot become a quiet
no-op, and a cap asserts it is not removing absurdly many, because a stripper that grows
would **hide real writes** — noisy in one direction, silent in the other, so both get a number.

The guard's own instruction, "never widen this test", is respected: nothing about which
literals are legal changed, and a phantom sitting anywhere outside a label map — including
elsewhere in the very file the carve-out protects — still fails.

Proved by sabotage, four ways, each watched red and each file restored:

| sabotage | result |
|---|---|
| a phantom `rsvp_status: 'RSVP'` outside the label map, same file | 🔴 1 fail |
| the stripper's pattern made to match nothing (floor) | 🔴 5 fail |
| the stripper made to eat every `{…}` (cap) | 🔴 5 fail |
| restored | ✅ 7 pass |

SPEC IMPACT: None.

### Follow-up, after the carve-out was challenged

The first version also required the identifier to end in `_LABELS`, and that was objected to on
good grounds: anchoring a correctness guard on a variable's **spelling** means a rename to
`FIELD_TITLES` turns a correct file red 35 minutes into CI, and the person who hits that under
time pressure will contort the map until the matcher stops seeing it — the exact outcome the
carve-out exists to prevent.

**So the broader form was tried — strip ANY module-scope `Record<string, string>` const — and
it was measured rather than reasoned about:**

```
any Record<string, string> const : 208
...of those ending _LABELS       :  20
```

Ten times the blind spot, **and a real payload inside it**:
`app/dashboard/[eventId]/schedule/actions.ts` declares `const patch: Record<string, string>` and
passes it to a write. The broad carve-out would have silently stopped checking it.

🔑 **The objection was right about the weakness and the proposed cure was worse than the disease.**
The name condition is kept, and the objection is answered two other ways instead:

- a new **WRITE_CALL** assertion fires if any stripped map's name is passed to `.insert(`,
  `.update(` or `.upsert(` in the same file — independent of the name, so it also covers the
  residual hole in the narrow form;
- the coupling is now written **at the declaration site**, where a renamer will actually see it,
  rather than only in the guard they are not reading.

Sabotages, each watched red: a phantom outside the label map · the label map passed to a write
(WRITE_CALL fired, 5 fail) · stripper matching nothing (floor) · stripper eating every `{…}` (cap).

SPEC IMPACT: None.
