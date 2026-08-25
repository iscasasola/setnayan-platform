## 2026-08-25 · fix(loading): 27 screens borrowed a loading title from a neighbour that has one

Third and last pass on the retired page header. The first sweep fixed every screen that had **its own** loading file. This closes the ones that **borrow** somebody else's.

### What a person saw

Open **Alaala**, the **checklist**, **galleries**, **people**, **launch**, the **suite**, **access requests** or **story assignments** — or, on the supplier side, **clients**, **fees owed**, **payday**, the **calendar**, **proposals**, **partnerships**, **demand**, **deep search**, the **shop's own page**, or either **subscription** screen. For a beat you get a wide grey bar with a thinner one under it: the shape of a title and a subtitle. Then the real screen lands with neither and **everything jumps up about 64 pixels**.

None of those 27 screens has a loading file of its own, so each borrows the nearest one above it — and **that** file draws a title because the screen *it* was written for genuinely has one. Event home has a heading. The supplier's home has a heading. The 27 borrowing them do not.

### Why the first two passes missed it

🔑 **THE RULES ASKED EACH LOADING FILE ABOUT ITS OWN SIBLING PAGE.** A loading file also stands in for every route *below* it that has no nearer one, and nothing was asking about those. 172 loading files were checked; **198 routes** actually resolve to one.

### What changed

- **27 route-local `loading.tsx`**, each shaped to its own screen and drawing no title.
- ⚖ **Adding a boundary here is status-neutral, checked rather than assumed.** A route-level loading file makes the shell commit HTTP 200 before the body runs — that is what turned a `notFound()` into a soft-404 on `/v/[slug]` (`app/[slug]/_lib/first-byte.test.ts`). **Every one of these 27 routes ALREADY streams** through the boundary it was borrowing, so nothing here changes when the status commits. Measured for context: **35** pages in this app already pair `notFound()` with their own sibling loader, and 33 more stream via an ancestor.
- `checklist` reserves **one** header element — not a button: its masthead carries the *"x of y ticked"* progress readout.

### The guard grew a ninth rule — and the eighth found something on the way

**Rule 9** walks the real coverage map: for every loading boundary, every route that resolves to it. If the boundary paints a title, every route it covers must draw one. Redirect stubs are exempt by shape (a page whose whole body sends you elsewhere draws nothing). Floored at 15 shared boundaries so the map cannot silently break.

🪤 **AND ADDING `checklist/loading.tsx` MADE THE GUARD CATCH A THIRD PLACE A MASTHEAD CAN HIDE.** `checklist/page.tsx` renders its masthead from `_components/checklist/checklist-full.tsx` — neither `page.tsx` nor a `_surfaces/*` tab surface, the only two shapes yesterday's fix knew about. **The rule written to refuse to go blind refused, out loud, on the first new case.**

🔑 **SO THE TWO RULES NOW SHARE ONE TRAVERSAL, WHICH IS THE WHOLE LESSON.** The heading rule and the actions rule each locate "where does this route's UI live?", and yesterday they answered differently — one recursed four levels, the other stopped at the front door. They now call the same `routeFiles()`, and **rule 7 is rewritten to assert they agree**: if any file the heading rule can reach carries masthead actions, the actions rule must have seen them too. Narrow either traversal and it goes red.

⛔ **A tabbed shell is still judged on the tab it opens on, and the traversal deliberately stops there** — falling through would demand a reservation for a button that only appears once you have navigated to a *different* tab, which is phantom chrome on the load a person actually makes. That exemption is recorded in rule 7 rather than left implicit.

🛡 **4 mutations, each printed before → after, all RED, restored green:** delete one of the eight couple loaders (present 1→0) · delete a supplier loader (1→0) · stop `checklist` reserving its readout (1→0) · **narrow the shared traversal back to `page.tsx` only — which takes down FOUR rules at once (recursion sites 1→0)**, the strongest evidence that the symmetry fix is load-bearing rather than tidy.

✅ typecheck exit 0 · `next lint` exit 0 · **9977 unit tests pass** · masthead / port-controls / radius / changelog-dir lints pass.

SPEC IMPACT: None — loading-state shape only.
