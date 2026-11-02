# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · feat(bench): one voice across all 70 category and folder explanations

Owner: *"make it fun and attractive that makes them want to add these"* — then, asked whether to
re-voice everything or only the new lines, **"Both."**

### What changed

All **70** ⓘ lines rewritten in one pass, so the bench reads as one author rather than three
sittings: 34 plan-group hints, 20 tile hints, 16 folder hints. Previously 36 of them were written
today in a warmer register while 34 stayed in the older operations-manual voice — a couple reads all
of them in one scroll behind identical buttons, so a tonal split reads as two products.

Before → after:

- *"Where you celebrate after."* → **"Where the toasts land and the dancing starts."**
- *"Sets the energy of your reception."* → **"The first song that pulls your titas onto the floor."**
- *"Keeps far-venue guests stress-free."* → **"Nobody hunting for parking or a ride home from a far venue."**
- *"Security, escorts, medics, marshals, generators, portalets."* → same nouns, then **"Nobody notices them; that means they worked."**

### 🕊 The four farewell lines, and the guard that survived

The owner asked that the funeral lines join the register too, which reverses the restraint shipped
earlier today. They did join it — **without acquiring urgency**:

- Cremation: *"There is no rush on the niche; many families decide later."* — a cue that is the
  **opposite** of scarcity.
- Funeral home: *"They carry the arrangements, so the family can simply be together."*
- Memorial park: *"a place the family can return to, for as long as they need."*
- The folder: *"The services that carry a family through the week."*

🔑 **So the existing guard did not need removing, and was not removed.** It fails the build if any
farewell line grows *book · months out · early · fills up · hurry*, and it still passes — verified by
mutation, both by running it and by injecting *"Book early, the good homes fill up"* and watching it
go red. Warmth and pressure turned out to be separable, which is the whole reason the guard was worth
keeping.

### The real risk of a re-voice, now guarded

A rewrite is exactly where a hard-won number quietly disappears. **NEW: `a re-voice never drops a
booking timing`** pins 15 figures across the whole corpus — the licence being valid **120 days**,
crews being **15-25 people**, rings at **6-8 weeks**, and 12 more. Mutation-checked: replacing the
licence sentence with "Start early." turns it red and names the lost figure.

**NEW: `the warmer voice did not turn into a sales pitch`** rejects scarcity and pressure wording
(*limited time · act now · only N left · hurry · cheapest*) across all 70 — because "make it
attractive" and "make it push" are one bad edit apart.

### Tests

11 in `category-hints.test.ts` (9 existing, 2 new), 60 green across the adjacent suites.
Mutation-checked: dropping a booking timing · scarcity wording appearing · farewell growing urgency.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 — one voice across all 70 lines, owner-directed; the
farewell restraint STANDS as a guard even though the copy warmed.
