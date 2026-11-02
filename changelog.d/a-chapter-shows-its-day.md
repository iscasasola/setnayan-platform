## 2026-08-21 · feat(story): a person's page shows their day — and scale carries meaning

**Owner, on the page as it was: *"looks like a text. it doesn't look as modern and
attractive for a person to create their stories."*** Then, on the redraw: *"already
the best look for us? did you check across the internet."* I had not. Seven
researchers went and looked; two judges scored the draft **6.5/10**. This is what
they sent back.

### 🔑 The one thing no competitor does

Measured across the field: **Zola ships 1,618 designs and two layouts** —
"How We Met" and "The Proposal" get identical size and no photographs.
**Appy Couple's section is literally called *Stories* and renders six identical
polaroids**, a first date and an engagement in the same rectangle. **The Knot's
largest word on the page is "Wedding."** Nobody varies size.

So this page does: **a chapter with a photograph AND writing takes the width, one
with either takes a strip, one with neither takes a line.**

### 🪤 And the way that dies, which the research was blunt about

The two publications with the least per-item authoring — The Atlantic (15 of 18
figures at an identical width) and Cereal (one body size) — **both abandoned
variation entirely rather than art-direct every item**. A rule needing a person to
say *"this one is big"* stops happening in week two.

**So the size is derived** (`lib/chapter-weight.ts`) from two facts the product
already holds: does it carry a picture, did they write something. Nothing new is
asked of anybody, and a chapter grows on its own as it is filled in.

⚖ **It never asks what KIND of celebration it was.** Ranking by event type would
be the product deciding a wedding matters more than a graduation, on a page about
somebody else's life — and it fails the person whose biggest day was a debut.
Effort and evidence are the honest proxies. Asserted.

### 🔒 The photographs are public-safe, and they reach everybody

`lib/chapter-picture.ts` reuses what `lib/auto-recap.ts` already proved: only
**wall-safe derivatives** — faces blurred INTO the pixels by `lib/face-blur.ts`,
NSFW-screened, **fail-closed** (no baked safe copy ⇒ not in the snapshot) — and a
chapter's own video still as the fallback. **The unblurred master is never
named**, and a guard counts `r2_object_key` on this page to zero.

✅ **AND IT IS NOT A PAID FEATURE.** The wall's entitlement gate was removed when
the Live Wall became free for every event (migration 20271137526696), so any
celebration with photographs has public-safe copies — not only the ones that
bought a wall. Checked before building on it.

🪤 **ONE SNAPSHOT PER CELEBRATION, NOT PER CHAPTER.** `getWallSnapshot` is 4–5
round trips and presigns R2 URLs; per-chapter would rebuild the exact defect
measured on the event page (95 questions per visitor, 78 of them repeats).
Chapters are grouped by their day and each is fetched once. Guarded.

### Also

- 🪤 **A year of nothing but lines is a receipt, not a year** — when a year has
  nothing above a line, its newest is promoted so the year has a shape.
- **A year has at most one lead.** Two full-width blocks side by side is the
  layout losing its nerve; the claim is that size means something.
- ⚠ **The lead carries ONE SENTENCE, never an essay.** The research bride has
  *"two sentences and four hundred photographs"* — a slot built for a long read
  is the slot she is least able to fill, in the most prominent place on her page.
- 🧹 **The retired one-size spine is DELETED, not left to rot** — 25 dead CSS
  rules removed, and a guard counts them to zero. Two stale comments naming those
  classes are corrected.

🪤 **THE PORT GUARD CAUGHT A REAL REGRESSION AND I FIXED THE CODE, NOT THE GUARD.**
Hoisting the chapter link into a `const href` made the destination invisible to
`lint-port-no-lost-controls`, which correctly reported `/u/[seg]/c/[seg]` as
unreachable. Inlined at all three call sites — a destination must be legible where
it is used, which is also how a page silently loses a door.

🪤 **AND TYPESCRIPT NARROWED AWAY THE ASSIGNMENT.** `weights.every(w => w === 'line')`
now infers a type predicate, narrowing the array to `'line'[]` inside the branch —
so the very assignment the function exists to make stopped compiling. Rephrased as
`!some(w => w !== 'line')`, with the reason recorded.

**Verification.** 7 unit tests on the size rule + 7 source guards · **964 app
tests** · typecheck clean · lints clean. **5 mutations, each landing verified by
occurrence count, all 5 RED**: three sizes collapse to one (1→0) · weight stops
being derived (1→0) · lead expects an essay (1→0) · page reaches the unblurred
master (0→1) · a snapshot per chapter (1→0).

⏭ **Not in this slice, and named:** the "Who was there" band (ninong · ninang ·
abay). It is the strongest idea in the design and **publishing guests' names on a
public page is an owner ruling nobody has made** — the 2026-08-17 face-blur
ruling covers faces in photographs, not names. Also open: the desktop rail, and
the owner's own view of the page.

SPEC IMPACT: `DECISION_LOG.md` — a chapter's size is derived from picture+writing,
never from event type, and never chosen by hand.
