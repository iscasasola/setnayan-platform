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
