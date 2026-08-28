## 2026-08-27 · fix(admin): the category the owner asked for opens a filled-in form

The owner typed, in production, **"add a new category on the taxonomy service"**.
Three pull requests (#4888 · #4892 · #4895) built, exposed and made reachable the
flow that answers it — and his sentence still ended on an **empty form**.

🔴 **THE WRONG JOB WAS WIRED, AND THREE FILES SAID IT WAS THE RIGHT ONE.**
A **category** is a tile under a parent folder (`createTaxonomyNode`, fields
`parent_id` + `label_en`, both refused when empty). `createCanonicalLeaf` adds a
**service inside a category that already exists** — a different act, on a
different form. Only the latter was ever read back, and #4895's PR body,
changelog and two docblocks each called it *"the job behind the box's own
flagship example"*. So the box asked his two questions and discarded both
answers, while every guard stayed green — because the job that WAS wired was
wired correctly. **Naming the flagship wrongly is how a feature comes to be
complete for everything except the case it exists for.** Corrected in all four
places, not only in the code.

**2 of 185 form-driven jobs now prefill** (`createTaxonomyNode` +
`createCanonicalLeaf`). The other **183 deliberately keep #4895's honest
fallback** — they show what the form will ask for and a button that opens the
page, rather than a questionnaire whose answers go nowhere. **This is not
complete for all jobs and does not claim to be.**

**What ships**

- The taxonomy studio reads `createTaxonomyNode` back and opens a **real
  prefilled form** — folder picker + category name + a Create button the admin
  presses. Same-route asks work (the studio is where an admin already is when
  they ask this), and a second ask remounts the inputs.
- 🔑 **The parent is resolved, never guessed.** The box only ever has the WORDS
  the admin typed, so a miss leaves the picker on the folder already selected
  **and says so on screen**. Filing a category under a silently-wrong parent is
  worse than asking once more.
- ⚠ **An ask moves the studio to a view that renders the tile grid.** Four views
  replace that pane entirely, so an ask arriving on Requests would have prepared
  the form into somewhere not on screen — this feature's own recurring failure.
- 🔒 **It prepares, it never presses** (one-person admin plan, 2026-07-11),
  pinned by a guard anchored on the prefill form, not on the file — the everyday
  "Add tile" control calls the action from a click and is untouched.

**Ranking now weighs capability, because relevance alone made this worse**

Measured over the shipped data for that sentence, both ways:

| | position of the capable job | taxonomy jobs above it |
|---|---|---|
| old positional `slice(0,120)` | `createCanonicalLeaf` @117 of 120 | 4 |
| #4895 ranked, cap 140 | @23 of 140 | **14** |
| this change | **@1 of 140** (`createTaxonomyNode` @2) | **0** |

All fourteen were prefill-**incapable**, and ten were newly promoted past it:
seven carry the literal word *category* he typed, while the two jobs that can
finish the task are labelled *"Create taxonomy node"* and *"Create canonical
leaf"* and score **one** shared word. **Ranking by word overlap without regard to
capability promotes the candidates that cannot help.** A capable candidate now
earns one extra shared word — a nudge, not a veto; the incapable ones are still
offered, just no longer first — and it is **gated on already having a match**,
so a neutral question still returns the list exactly as it arrived. All 86 pages
still survive the cap.

**Two guards were decoration, both proved by mutation with counts printed**

- `buildNavRows(askRowSelectable, hits)` → `buildNavRows(false, hits)` (1→0)
  reproduces the #4892 bug exactly — the offer renders and highlights, but the
  list the keyboard walks holds only page hits, so Enter opens Taxonomy.
  **156 pass, 0 fail, exit 0.**
- `const hitOffset = askRowSelectable ? 1 : 0;` → `= 0;` (1→0) — the only thing
  aligning each highlight with the row Enter opens. **156 pass, 0 fail, exit 0.**

🔑 **Why neither could fire.** The order tests call
`buildNavRows(offersAssistant(FLAGSHIP), hits)` — they supply their **own** first
argument, so they can never see what the component passes; and the source greps
matched `const target = navRows[sel]` and `target.kind === 'ask'`, which both
survive the mutation as **dead code**. *A regex matching unreachable code is not
proof of reachability, and a test that hand-feeds the argument under test cannot
see the wiring break.* The offset is now **derived from the rows** (`hitOffsetOf`)
and walked over every hit, and the two arguments the component passes are pinned
as wiring against comment-stripped source.

🪤 **And my own first capability guard was phrased as the rule's own inequality**
("a non-capable job may outrank a capable one if it shares more words") — which
the defect satisfies, and which could not see the tie-break key at all. Rewritten
to assert the measured **outcome**; sabotage S11 (dropping that key) is red only
because of the rewrite.

**12 sabotages, every one landed (target count 1→0) and every one RED.**
Baseline 239 pass / 0 fail; full unit suite 10,320 pass / 0 fail, exit 0;
typecheck exit 0 / 0 errors — first run aborted at **exit 134 (OOM) while
printing `errors=0`**, which is why the exit code is printed beside the count.

SPEC IMPACT: None. No schema, no migration, no price, no flag. The
"routes only, never acts" boundary and the admin-console one-table guard are
untouched; nothing here can submit a form on the admin's behalf.
