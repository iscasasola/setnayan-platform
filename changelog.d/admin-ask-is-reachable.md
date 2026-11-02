## 2026-08-27 · fix(admin): the assistant offer is reachable by the gesture the owner actually uses

The owner typed the spec's own flagship sentence into production — *"add a new
category on the taxonomy service"* — and the search box navigated him to the
Taxonomy page. PR #4892 added an "Ask Setnayan" offer for exactly that case and
**did not fix it**. Five defects, each re-verified here by execution before
being touched.

### 1 · The offer existed and could not be reached

Measured for that sentence on the shipped data: 16 page hits under 15 group
headers, with the offer rendered *after* all of them inside a 430px scroller —
about two and a half screens down. Worse, the arrow keys and Enter both indexed
the page hits alone, so the offer was in **neither key path**. The owner
repeated his gesture, pressed Enter, and got the same navigation he was
complaining about. *A fix nobody can reach is no fix* — the fourth time this
project has written that sentence down.

The offer is now the **first row**, in the same shape and slot as a matched job
row, inside the one list both the keyboard and the renderer walk.

⚖ **PRODUCT CALL, STATED SO IT CAN BE REVERSED IN ONE LINE.** When the query is
sentence-shaped and no deterministic job matched, the offer is first **and
therefore default-selected**, so Enter asks the assistant instead of navigating.
Rationale: the person described a task rather than naming a page, nothing
matched deterministically so confidence in the top page is low, and the page is
one arrow press away. To reverse, move the ask row to the end of `buildNavRows`
in `lib/admin-map/palette-nav.ts`. **Nothing changes for ordinary noun-shaped
lookups** ("papic pricing", "taxonomy", "pending") — asserted, both that they
grow no extra row and that they still select the same row first.

### 2 · 82% of jobs could never produce a form

`ask-actions.ts` handed the model `choices.slice(0, 120)` over a list built as
pages-then-jobs. Measured: 86 pages + 185 form-driven jobs = 271, of which
**34 jobs survived and 151 (82%) never reached the model**. `createTaxonomyNode`
was **already cut**; `createCanonicalLeaf` — the job behind the flagship — sat
four new admin pages from the same fate; and **37 of the 43 jobs on the taxonomy
surface**, the most job-dense page in the console, were beyond the cut.

Candidates are now ranked by relevance to the question and sliced second, with
the original position as the tie-break so a neutral question reshuffles nothing.
The cap is **140**, measured rather than rounded: at 120 the ranking pulls all 43
taxonomy jobs in but pushes **14 of the 86 pages out**, trading a job fix for a
page-lookup regression.

### 3 · Answering while already on the destination page discarded every answer

The one page that reads the prefill did so in an effect with an empty dependency
array. The search box is mounted on every admin page, so the likeliest place to
be when adding a taxonomy category is that page itself — a same-route
navigation, which reconciles rather than remounts. Nothing opened, nothing
filled, no error. Fixed, keyed on the ask params alone so typing in the filter
box cannot re-apply a prefill over the admin's own edits. A second half was just
as quiet: the inspector was keyed on the tile id, so a second ask about an
already-open tile never refreshed its uncontrolled inputs.

### 4 · The box stopped promising a fill that never happens

Measured over the tree: exactly **one** page reads these answers back, for
exactly **one** job. For the other 184 the box gathered up to eight answers,
said *"the page opens with this filled in"*, and opened a page that never
looked. Those jobs are no longer asked questions at all — they are shown what
their form will want, and a door to the page. The registry of real consumers is
**derived and checked against the admin tree in both directions**, not trusted.

### 5 · Two guards were decoration, proved by mutation

The escape-hatch guard declared its **own** copy of the sentence threshold and
grepped source for the *identifier*, never the value: changing the shipped
threshold from 3 to 6 — which silently deletes the feature for the five-word
flagship — left it at `# pass 4 # fail 0`. Adding `display: none` to the offer
left it green, and left all 109 admin component tests green. And nothing
anywhere guarded the choice cap: severing every job from the model changed no
test result in the repo.

The rule now lives in a plain importable module so the guard executes the
shipped logic instead of describing it. All three of those sabotages now fail,
each verified by occurrence count before → after.

The assistant still only ever routes and prepares; it never submits. The
one-person admin plan's boundary (2026-07-11) is untouched, as is the generated
route map and job checklist.

SPEC IMPACT: None. Behaviour of an internal admin tool; no pricing, SKU, schema
or customer-facing surface changes. The default-selection call above is a
reversible product choice, flagged for the owner rather than assumed.
