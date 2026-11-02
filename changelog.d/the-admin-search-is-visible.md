## 2026-08-26 · fix(admin): the search you can see is the admin's own

Owner, on the finished feature: ***"i do not see the AI searchbar."*** He was
right, and nothing was broken — it had never been given a door.

The admin's palette knows its 96 pages, 284 jobs and every price row, answers a
whole sentence, and asks a model for phrasings nothing has seen. **All of it
opened with ⌘K and nothing else** — no button, no label, and no shortcut at all
on a phone. Meanwhile the one visible box on the admin bar belonged to the
**shared** palette, which looks through the person's own events, people and
vendors. So the console had an assistant, and the only control on screen opened
something else.

*A fix nobody can reach is no fix.* Third time this project has paid for that
exact shape.

**What shipped:** the shell gained an optional `searchSlot`, and the admin hands
in its own — a field reading *"Search or ask — 'papic prices', 'add a category'"*
with the ⌘K hint still on it. ⌘K is unchanged: a second door onto one room.

- 🔑 **It looks like a field and is a button.** A real `<input>` would mean two
  inputs for one search, and the palette steals focus the moment it opens — so
  the first keystroke would land in a box about to be replaced.
- 🔑 **The button and the panel share ONE event name from a leaf module.** A
  button that looks alive and opens nothing is the quietest failure in this
  family; neither side may type the string.
- ⚖ **Desktop only, per the owner's 2026-08-26 ruling** that the phone admin
  answers what needs a decision and does not edit — this box opens doors into
  editing screens. The phone keeps its own "All surfaces" filter, which already
  understands a sentence.

**Two existing guards fired and were taught the new shape rather than loosened.**
`one-top-bar.test.ts` pins that the shared rail branches its search on whether
anybody is signed in — the 2026-08-16 bug where a stranger was handed a palette
over events they do not have. The branch is unchanged and still pinned; it now
sits inside the fallback. Its twin compares both mounts byte-for-byte, so the
rail's inner expression is kept **character-identical** to the front door's and
only a `searchSlot ?? ( … )` wrapper is stripped before comparing. **Both were
re-proved by mutation**: making the two mounts genuinely disagree, and handing a
signed-out visitor the palette, each still go red.

**Guards** — 7 new assertions, 10 mutations, all RED after one fix (a mutation
that never landed because its marker had leading whitespace — an unmeasured
mutation proves nothing).

SPEC IMPACT: None.
