## 2026-09-09 · fix(story): a sample says what it is, and a wake gets no joyful recap

Two halves of one defect — the solemn register was honoured **inside** the story and nowhere around it.

### 1 · Every sample announced itself as a wedding

**Seen on the live site, not inferred.** `/realstories/[slug]` printed one hardcoded sentence above
all **21 samples**, which carry **17 different event types**:

> *"A sample of how a **wedding** is told on Setnayan once it becomes a story. Real **couple**
> stories — their own words, photos, and team — begin December 2026, published with the
> **couple's** consent."*

So a family's wake announced itself as a wedding and spoke to a bereaved reader about a couple; so
did a graduation, a house blessing and a company year-end. **The story beneath was already right** —
S13 threaded the occasion's words through it, and the wake renders *"the family"* throughout with no
Relive, no countdown and no anniversary.

🔑 **It was invisible to every sweep that looked for "couple" in the story tree, because it is not
in it** — it is on the showcase route that WRAPS the story. *A scan scoped to the tree you are
fixing cannot see the chrome around it.*

The sentence now reads the sample's own kind, and a solemn one is worded gently: a family's words
and photographs, no "team", consent still stated.

### 2 · `/[slug]/recap` had no solemn gate at all

Owner ruling 2026-09-09: a wake gets the quiet **story**; the **recap** — auto-composed in a joyful
voice with nobody's hand on it — stays refused.

**It was not refused.** The refusal everyone believed in lives in `solemnAdjustedPhase`, which
governs what a guest receives at `/{slug}`. The recap has its **own address** and gated only on
*"does this event have a website"* (true for every type shipped) and *"did the host publish"*, and
`lib/auto-recap.ts` contains **zero** occurrences of `solemn`. A grieving family that published
would have been handed the cheerful one.

Both arms are gated now — the metadata arm so it is not indexed, the render arm so it is not
served. Gating one alone is how a page becomes reachable while claiming not to exist.

⚠ **Inert when found** (no wake exists in production). Found by S13 reading the route rather than
the comment, after the corpus — and the session that wrote it — asserted the gate existed.
**A sentence in a docblock is not a gate on every route.**

### Measurement

`TSC_EXIT=0` **and** `ERROR_LINES=0`. 6 tests, count checked non-zero. Every `scripts/lint-*.mjs`
passes. **Mutation-tested three ways, counts printed before → after, all three RED:**

| sabotage | count | result |
|---|---|---|
| the banner goes back to a hardcoded "a wedding" | 1 → 0 | 6 pass → 5 pass, 1 fail |
| the wake is told about a couple and a team | 1 → 0 | 6 pass → 4 pass, 2 fail |
| the recap's render-arm gate deleted | 1 → 0 | 6 pass → 5 pass, 1 fail |

The sample bill is **derived from the shipped fixture**, so a 22nd sample of a new kind is covered
the day it is added. The recap guard is a source-text one, said so in its own docblock: it exists to
stop the gate being **deleted**, not to prove it works.

`SPEC IMPACT`: None — no schema, no pricing.
