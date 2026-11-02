## 2026-08-06 · fix(schedule,details): a Born Again or Jewish couple no longer gets a Catholic Mass

### What happened to a real person

A Born Again or Jewish couple pressed **"set up my schedule"** and their ceremony
filled with a Catholic Mass — **Communion, the veil, the cord, the coins.** They
then deleted another faith's rites from their own wedding, by hand, one at a time.

Nothing errored. Every test passed. The seed did exactly what it was told.

### Cause: a list that claimed to mirror the database and didn't

`events.ceremony_type` accepts **18** values. `SeedCeremonyType` listed **16** —
and its own comment claimed to *"mirror the events.ceremony_type CHECK constraint
values"*. `jewish` and `born_again` were added by migration `20260808000000` and
never reached the seed.

The dispatcher then fell through **twice** to Catholic:

```ts
CEREMONY_PARTS[ceremonyType ?? 'catholic'] ?? CEREMONY_PARTS.catholic
```

Both fallbacks pointed at one faith. So did the null branch — which is every
NON-wedding event, since the CHECK forces `ceremony_type IS NULL` for those. A
birthday could be handed a wedding Mass.

### The second surface, and it is worse

The couple's own **Details** page offered **8 of 18**. Born Again, Jewish,
Aglipayan, LDS, SDA, JW, Hindu, Sikh, Buddhist and Orthodox were all missing.

🔴 **Not merely missing — destructive.** A `<select>` whose `value` matches no
`<option>` falls back to the first one. A couple whose faith was set during
onboarding (which DOES offer all 18) opened Details and saw **"Choose a type…"**,
as if their faith had never been recorded. Editing anything else on that row and
saving would have written a different faith over theirs.

### The fix

- `jewish` and `born_again` now have their own rites. **Born Again** reuses the
  evangelical shape `faith-registry.ts` already describes (`christian` is defined
  there as *"Evangelical, Protestant & born-again churches"*) with the
  praise-and-worship opening those services lead with. **Jewish** is the spine
  common to every denomination — ketubah, chuppah, sheva brachot, breaking of the
  glass — and deliberately nothing more: the couple's rabbi decides the rest, and
  a confidently-wrong detail is worse than an honest outline.
- **An unrecognised rite now gets a NEUTRAL spine, never another faith's
  liturgy.** This is the part that matters most: it is the safe default for the
  next type added to the constraint before this file catches up, which is exactly
  how `jewish` and `born_again` became Catholic.
- The Details picker **derives from `ALLOWED_CEREMONY_VALUES`** — the canonical
  keyspace that already existed and already resolves to precisely the database's
  18. A faith added to the registry now appears there for free.

### The guard

`tests/db/ceremony-seed-covers-every-faith.db.test.ts` reads the vocabulary
**from the replayed CHECK constraint** — never re-typed, because a hand-written
list would be a third copy drifting the same way the second one did. It asserts:
every allowed type has its own seed · no non-Catholic rite contains
Catholic-only beats (`aglipayan` excluded, it shares the Filipino veil/cord/arrhae
tradition by design) · an unknown type gets the neutral spine · a null ceremony
does too.

**Sabotage-verified twice:** restoring the Catholic fallback fails 3 of 5;
deleting `born_again`'s rite fails 1 and names it.

### Verification

`tsc` exit 0 · all 15 lint scripts pass · **6,719 lib tests pass** · the 10
existing schedule tests still pass, so nothing was relying on the Catholic default.

SPEC IMPACT: None — no schema, pricing or locked decision changed. The ceremony
vocabulary was already 18 in the database; only the code disagreed.
