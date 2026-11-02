## 2026-08-01 · feat(vendor): a supplier can be two trades at one wedding — the plural, additively

Phase 1 of `Role_Scoped_Day_Of_DESIGN_2026-08-01.md` (owner concept, 2026-08-01).

**The problem.** A supplier can genuinely be two trades at one wedding — a band that also emcees, a
stylist who also hosts. `specializationSetForServices` walked the registry and **returned on first
match**, so the second trade's desk was permanently unreachable: a band that emcees could never open
the script desk we shipped this week.

**The finding that made this small.** The plural was already being computed and thrown away. One
layer down, `familiesForServices` already returns a `Set<DayOfFamily>`, already narrowed to the
event, and `resolveDayOfFamily` takes the first and discards the rest. The system already knew.

### What this adds

- **`specializationSetsForServices()`** — every set the vendor's tiles map to, in registry order.
  `specializationSetForServices` is now literally its first element, so the two **cannot drift into
  disagreeing** about who is eligible.
- **`unlockedSets` / `eligibleSets`** on `VendorSpecializationAccess`, populated on every return
  path.
- **`holdsAnySpecialization()`** — the plural sibling of `holdsSpecialization`.

### ⚠ Deliberately behaviour-neutral

**Nothing reads the plural yet, and `unlockedSet` keeps its exact meaning, so no surface widens by
accident.** Every existing call site still uses the strict predicate and still sees exactly one set.

That is the point. **Widening who can reach a paid desk is a product decision, not a refactor** — it
should be one visible, reviewed flip per call site, never a side effect of a plumbing change. The
first flip (the emcee Script tab, so a band that emcees can prep) belongs in its own PR against
#3994.

### The line that must not move

Both predicates read the **entitlement** (`unlockedSets`), never `eligibleSets`, so neither can be
talked past the tier floor. A locked vendor now returns `unlockedSets: []` on every locked path —
free, below-floor, and lapsed — while `eligibleSets` still carries the upsell. **The plural is not a
back door around the subscription**, and a test pins that for all three locked states.

### Verification

- **11 new tests** (34 in the file). The two that matter: a band+emcee holds **both** sets, and a
  locked vendor holds **none** while still being eligible for both.
- Also pinned: the singular is exactly the first of the plural across six service shapes (they can
  never disagree) · registry order wins regardless of how `services[]` happens to be ordered in the
  row · a set is never listed twice however many of its tiles the vendor holds · the event narrowing
  still applies · an **empty** `eventTiles` array does not narrow to nothing (it is truthy, and
  treating it as a narrowing set would hide every desk) · unknown/malformed tiles fall through
  rather than throw.
- `tsc --noEmit` **exit 0, 0 errors** (8 GB heap) · `next lint` clean · **`test:unit` 5,949 / 5,949**.
- No migration, no policy, no schema.

SPEC IMPACT: None yet — the design note is already in the corpus and this implements its Phase 1
without making any of its still-open decisions (§ 7).
