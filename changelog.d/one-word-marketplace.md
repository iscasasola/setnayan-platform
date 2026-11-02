## 2026-08-15 · fix(nav): one word for the place you look for suppliers — "Marketplace"

Owner, asked directly, pointing at the rail row: *"why do we have a find a
supplier. and sometime it is marketplace?"*

**He was seeing ONE row wearing TWO words, plus a heading wearing the second
one again.** All three point at `/explore`.

- On the public front page the row read **"Find a supplier"**.
- On every signed-in surface the SAME row read **"Marketplace"**.
- And three lines below it, the category group was headed **"Marketplace"**
  too.

### Why the same row said two things

`front-door-shell.tsx` renders that row through `slotLabel(RAIL_SLOT.find, …)`,
and `slotLabel` applies the nav registry **in the `app` variant only** — a
deliberate, documented choice made for a different row (the events row says
"Back to your events" on `/` on purpose). So the hardcoded fallback is what the
PUBLIC page shows and the registry label is what the SIGNED-IN pages show. The
registry's `customer.account.marketplace` slot has said "Marketplace" since
**2026-07-27** (owner: *"just use Marketplace so it is easier to understand"*,
label lineage Explore → Merkado → Marketplace). The fallback never followed.

🔑 **A defect that needs TWO files open to see.** Each file is self-consistent;
the divergence only exists in the pair. Nothing errored, nothing logged, and
every existing guard passed — the shell's own invariants file had five
assertions about this exact row and none of them looked at the word.

🔑 **The binding prototype contradicted ITSELF, and the port was faithful.**
`prototypes/front_door_and_seam_2026-08-12.html` renders "Find a supplier" at
line 851 while its own seam note at line 1598 reads *"Signed out it is called
Marketplace on the front door; signed in it is called Marketplace here. Same
word, both sides."* The port copied the drawing and inherited the
contradiction. **A prototype is binding about COMPOSITION; where it contradicts
its own written intent, the intent is the decision.**

### What changed

- The front-page fallback is now **"Marketplace"**, equal to the registry.
  Same word on both sides of the seam — which is what
  `DECISION_LOG.md` 2026-08-12 already said the design was.
- The collapsed-rail caption for that row: "Find" → **"Market"**.
- The category group heading is now **"Browse by category"** — it lists
  shortcuts *into* the Marketplace, and repeating the row's own word three
  lines under it reads as two different places.
- Three stale docblocks that named the retired word (`admin-rail-context.tsx`,
  `explore/loading.tsx`, `vendor-rail-context.tsx`).

### Guard

New `front-door-invariants.test.ts` case: **the rail fallback for the
marketplace row must equal its nav-registry label.** It reads the slot key out
of the shell rather than retyping it, then reads BOTH files. Mutation-checked
in both directions with occurrence counts measured before → after:

- fallback back to `'Find a supplier'` (1 → 0) ⇒ RED
- registry label to `"Browse vendors"` (1 → 0) ⇒ RED
- category heading back to `>Marketplace<` (1 → 0) ⇒ existing gate test RED

The existing gate test was re-anchored to `>Browse by category<` — not
relaxed; it still requires the row and the group to carry the identical
`account.signedIn` gate, polarity included.

### Deliberately NOT changed

The **event-scoped** supplier surface (`/dashboard/[eventId]/vendors`) keeps
the name "Marketplace" — owner-locked 2026-07-27, and PR #4436 shipped it an
`<h1>Marketplace</h1>` on 2026-08-14. The 2026-07-27 log flagged "two things
called Marketplace" as an unresolved owner call; 2026-08-12 answered it the
other way (*"the same word on both sides"*), and the date-blind public browse
and the date-aware event browse being one word is the shipped intent. The
third word was the anomaly, and it is the only thing removed here.

Route, slot key, `?folder=` params and every saved link are unchanged.

Verified: tsc clean · 175 unit tests across the 12 shell-adjacent suites ·
all 22 `lint-*.mjs` green (including `lint-port-no-lost-controls`).

SPEC IMPACT: `DECISION_LOG.md` row added (label canon: one word for
`/explore`, and the front-page fallback must track the nav registry).
