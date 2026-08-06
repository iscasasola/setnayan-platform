## 2026-08-06 · fix(faith): finish the job — #4198 fixed the schedule, three more surfaces still excluded them

**#4198 was correct and incomplete, and it was reported as done.** It fixed the
ceremony schedule and the Details picker. A Born Again or Jewish couple still hit
the same wall in three other places.

### What was still broken

| surface | what a couple saw |
|---|---|
| **Date wizard** (`four-question-flow.tsx`) | Their faith simply not on the list — 16 options where the type already allowed 18 |
| **Paperwork** (`lib/paperwork.ts`) | `resolveCeremonyType` returned `'unknown'`, so their documents page fell to the generic branch |
| **Tradition guides** (`lib/wedding-traditions.ts`) | No guide at all — found only because the compiler demanded it (see below) |

### Why the compiler couldn't see it

`CeremonyType` is declared in **three separate files**:

| declaration | members | missing |
|---|---|---|
| `lib/auspicious-date.ts` | 19 | none |
| `lib/paperwork.ts` | 16 | **jewish, born_again** |
| `app/admin/venues/_constants.ts` | 17 | **mixed** |

And the date wizard's list was a hand-typed **array**, not a record — **a subset
of a union is a perfectly legal `Array<{ value: CeremonyType }>`**, so TypeScript
had nothing to object to.

That is the exact blind spot the 2026-07-27 `ceremony-type-guard.test.ts` was
written for, one layer up: it pinned four runtime **guards** and never looked at
a **UI list**.

### The fix

- **Date wizard** → a `Record<CeremonyType | 'undecided', …>`, so a missing faith
  is now a **compile error**. Order derived from the record; `undecided` last.
- **Paperwork** → both faiths added to the union, the rows, and
  `resolveCeremonyType`. PH civil law does not vary the DOCUMENTS by rite — the
  solemnizing officer changes, the paperwork does not — so both take the same
  universal base as christian / cultural / chinese.
- **Tradition guides** → written for both, in the file's existing posture: a
  starting point plus an explicit *"confirm with your rabbi / your pastor."* The
  app does not presume to instruct anyone on their own rite. The Jewish entry
  flags the two things that actually bite in the Philippines — the officiant must
  ALSO be a registered civil solemnizing officer, and kashrut must be settled
  with the caterer before booking.

🔑 **The fourth surface was found BY the fix.** Adding two members to
`paperwork.ts`'s union broke `Record<TraditionGuideKey, WeddingTraditionGuide>`
in a file I had not looked at. That is compile-time enforcement doing exactly
what a hand-typed list cannot.

### Still open

`app/admin/venues/_constants.ts` is missing `mixed` — a different gap on an admin
surface. Logged in the register as P3; not folded in here, because a fix should
change what it claims to change.

### Verification

`tsc` exit 0 · all 15 lint scripts pass · **6,748 lib tests pass in UTC and
Asia/Manila** · the #4198 faith-coverage guard still green.

SPEC IMPACT: None — the ceremony vocabulary was already 18 in the database.
