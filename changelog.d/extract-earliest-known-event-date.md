## 2026-08-01 · refactor(dates): one implementation of the "earliest known event date" ladder — extracted to a neutral, dependency-free home

Two functions computed the same three-step ladder over the same three `events`
columns:

| Function | Module | Gate |
|---|---|---|
| `resolveEarliestDate(ev)` | `lib/wedding-roadmap-signals.ts` | none — the bare ladder |
| `checklistAnchorDateFor(event)` | `lib/checklist.ts` | weddings anchor on `event_date` alone |

The ladder in both: locked `event_date` → earliest `date_candidates` →
`date_window_start`.

Both now call **`earliestKnownEventDate()`** in the new
`apps/web/lib/event-dates.ts`. `checklistAnchorDateFor` keeps its wedding gate
and layers it on top.

### Why a THIRD home, and not "one of them imports the other"

PR #4020 declined to reuse `resolveEarliestDate` for a stated reason, and that
reason was sound but narrower than it read: importing from a module named
**wedding-roadmap-signals** in order to express *"weddings do NOT use this
ladder"* would obscure the one rule the checklist anchor exists to state.

That is an objection to **naming and dependency direction, not to sharing.** A
neutral third home dissolves it — neither surface depends on the other's module,
and the checklist anchor still states its rule in its own words.

The two are also **different kinds of thing**, and the extraction cuts along
that seam. *"The earliest date we know about for this event"* is a type-agnostic
**fact** about a row. *"Weddings anchor on the locked date alone"* is **policy**,
and it belongs to the checklist. What the new module exports is a primitive, not
the checklist's contract — so #4020's header assertion that
`checklistAnchorDateFor` is **not** a cross-surface contract remains **true**,
and it has been left standing, updated only to record what it now composes.

### Why it was worth doing at all

The drift risk is **asymmetric and already demonstrated, in this code, this
week**. Fix an edge case in one copy — an empty `date_candidates` array, a
malformed value, a non-array — and the other silently keeps the bug. That is the
exact shape of the #4020 defect: two surfaces a click apart answering the same
question differently, with the **wrong one under-reporting** and therefore never
complaining.

### Behaviour: unchanged, and proved rather than asserted

The two implementations were **equivalent on every input** — there was no
edge case to choose between, so nothing was preserved-by-union and no fix was
smuggled in. Differences examined and found immaterial:

- `resolveEarliestDate` had a redundant `.slice()` between `.filter()` and
  `.sort()`. `.filter()` already returns a fresh array, so it was a second copy
  of a copy — neither implementation could mutate the caller's row.
- `resolveEarliestDate` ended `?? candidates[0] ?? …` (yielding `undefined` on an
  empty array, which `??` falls through); `checklistAnchorDateFor` ended
  `.sort()[0] ?? null` and then `?? …`. Same result at every step.
- `checklistAnchorDateFor` hoisted `const lockedDate = event.event_date ?? null`
  before the `??` chain. `x ?? null ?? y` ≡ `x ?? y`.
- A `as string[]` cast in one and not the other — types only, no runtime effect.

`lib/event-dates.test.ts` does not take this on trust: it pins **both retired
implementations verbatim** and asserts all three agree across the full
cross-product of `event_date` × `date_candidates` × `date_window_start`
(90 shapes, including unsorted candidates, holes, all-empty arrays, malformed
and unpadded dates, and null vs undefined vs a missing property).

### Purity is load-bearing

`lib/event-dates.ts` imports **nothing** — no I/O, no `server-only`, no
Supabase, no React — so either surface, client or server, can read the ladder
without dragging a server module behind it. A value import from a server module
into a client-reachable file compiles fine locally and fails only at
`next build`, i.e. only in CI, after review. A test asserts the file stays
import-free.

### Also in this change

- `resolveEarliestDate` is **removed**, not aliased. It had no caller outside its
  own module, and leaving an export would invite a future surface to reach the
  ladder *through* a server module instead of the pure one. `fetchRoadmapState`
  calls `earliestKnownEventDate` directly.
- `RoadmapEventRow` and `ChecklistAnchorEvent` now both extend the shared
  `EventDateFields`, so widening the ladder widens the row types that feed it.
- Corrected a **false claim** in the `wedding-roadmap-signals.ts` header: it
  advertised `resolveEarliestDate` and `deriveRoadmapSignals` as "unit-tested".
  Neither had a test file. The ladder now genuinely has one, at its new home.
- Source-contract tests assert both surfaces keep *calling* the helper and
  neither re-inlines the ladder — the failure mode that created the two copies.

### Not touched

`lib/checklist-anchor.test.ts` (19 cases, including its two source-contract
tests that read the launcher and checklist pages) passes **untouched** — the call
sites and `checklistAnchorDateFor`'s signature are unchanged. The wedding gate is
still pinned there, deliberately: it is the checklist's rule, not the ladder's.

Verified: `next lint` clean · **6119/6119** unit tests pass · `tsc --noEmit`
clean.

SPEC IMPACT: None. No user-visible behaviour, no schema, no pricing, no SKU, no
copy, and no product decision changes — this moves one arithmetic expression to
a shared address and proves the move was a no-op. The two surfaces it serves
(Studio's recommendation heuristic and the couple checklist's deadline anchor)
render exactly what they rendered before.
