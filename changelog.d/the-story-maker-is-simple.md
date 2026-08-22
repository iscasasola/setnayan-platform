## 2026-08-22 · fix(story): the story maker opens as two boxes, not six

Owner, on the story maker: it should be *"very easy to handle."*

"The words" presented six equal input boxes — Eyebrow · Headline · Sub-headline ·
Your story · Pull quote · Byline — so the page read as a form to complete rather
than a story to correct.

- **Up front:** the **Headline** and **Your story** — the two things a person
  opens this page intending to write. The story textarea grows 120px → 160px.
- **Behind a fold ("The smaller lines"):** eyebrow, sub-headline, pull quote and
  byline. They are magazine furniture — typographic slots our composer already
  fills, whose names are a newsroom's words, not a couple's.

🔑 **The split is by WHO THE FIELD BELONGS TO, not by how often it is used.**

⚠ **Nothing is removed and nothing is gated.** Every field keeps its exact state,
handler and placeholder. A `<details>` keeps its children mounted, so an unsaved
edit inside the fold survives being collapsed and still submits — a conditional
render would unmount them and throw that edit away.

🛡 `lib/the-story-maker-is-simple.test.ts` — 5 assertions, **each verified to
land by measurement and each red**: the Byline field deleted (1→0) · the Headline
moved into the fold (above-the-fold `true → false`) · `<details>` swapped for a
plain div (1→0) · a state handler dropped (1→0) · `<summary>` replaced by a div,
which would make the fold unreachable by keyboard (1→0).

🪤 **One mutation reported RED while never landing, and I nearly kept it.** My
first attempt at "push Headline into the fold" produced `1 → 1` — the replacement
string still contained the searched string — and the suite failed anyway because
the JSX was broken. **A red from a mutation that did not land proves nothing.**
Redone as a real move.

🪤 **Then my re-measurement was wrong for a second reason:** it compared raw
source positions, and the docblock I had just written mentions `<details>` — so
the "element" it found was a word in a comment, and the check read `false → false`
on a change that had landed. The guard itself strips comments; my measurement did
not. **Measure the way the guard measures.**

SPEC IMPACT: None — no price, SKU or locked decision moves.
