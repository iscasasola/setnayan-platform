## 2026-08-26 · feat(admin): what each admin job asks for, read out of the code

The second half of the map the owner asked for (2026-08-26): *"on taxonomy, it
is like having a pick category, and other details"*. The steps of a job are the
part nobody remembers — and they are already written down, in the action that
performs the job.

**What shipped**

- `scripts/gen-admin-jobs.ts` → `lib/admin-map/admin-jobs.generated.ts` — all
  **278 admin jobs**, **180 of them form-driven**, each with the fields it reads,
  the fields it provably refuses when empty, whether it takes something away, and
  the page you would actually open to do it.
- Those words join the search: a page is now findable by the WORK done on it.
  Typing *refinement*, *faith*, *canonical leaf* or *planning deadline* finds
  Taxonomy — none of those words appear in its name or its description.

**Honest limits, stated in the code**

- ⚠ The field is called `refusedWhenEmpty`, **not `required`**. Validation is
  written at least four ways in this admin; a scan that catches two of them
  would, under the name "required", assert that everything else is optional.
  `createCanonicalLeaf` is the worked example — it refuses an empty `tile_id`
  with `if (!tileId)` and an empty name with `label.length < 2`, and the first
  cut reported only the first (22 jobs → 46 once both shapes were read).
- ⚠ This does **not** make *"add a new category"* work. The code's words are the
  code's; a person's words are their own. Closing that gap is the assistant's
  job — deliberately not a synonym list, which the palette's own notes already
  warn becomes a second vocabulary to maintain.

**Two bugs the guards found, neither by reading**

- 🪤 **Five jobs lived in a folder with no page.** Three sit under a
  `[editorialId]` template you reach by picking a row; two are in
  `/admin/storytellers`, a folder holding actions and nothing else — its screen
  moved into a Studio tab and the actions stayed behind. Each job now resolves in
  three steps (its own folder → the page that imports it → the nearest real
  ancestor), and a guard refuses any job that resolves nowhere.
- 🪤 **The join ran in the wrong order.** Job words were attached before the map
  added its own destinations, so three jobs on the demo-vendor inquiries screen
  found no page yet and were dropped on the floor, silently unsearchable.

**Guards** — 6 new assertions, 8 mutations, all RED. 🪤 One mutation was itself
fake on the first run: to test the ordering fix I appended a comment rather than
moving the loop, which landed by occurrence count and proved nothing. Redone by
actually relocating the block and asserting its new index — a reordering
mutation cannot be measured by counting a string.

A job whose page is hidden behind a feature flag keeps its words hidden too, and
that exception set is **derived from the map, never hand-listed**.

🔎 **The freshness guard proved itself on a real event, not a mutation.** While
this branch was in flight, another PR merged five new admin jobs
(`settle*FromWorkList`). Rebasing and regenerating picked all five up — which is
exactly the drift a hand-written checklist absorbs silently and a scanned one
cannot.

SPEC IMPACT: None. No schema, no pricing, no product surface — the same pages,
findable by more of the words people actually type.
