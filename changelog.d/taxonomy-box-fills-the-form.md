## 2026-08-27 · feat(admin): the search box fills in 22 more of the taxonomy page's forms

The admin ⌘K box can gather a job's answers and open the destination page with
the form already filled in. Measured on `origin/main`, exactly **2 of 185**
form-driven jobs did that, and both were on `/admin/taxonomy` — a page that
hosts **43**. So 41 of them asked the admin questions and threw every answer
away, with no error and nothing to blame.

**22 of those 41 are now read back, by ONE reader rather than 22 hand-written
ones.** 24 of the page's 43 jobs now fill their own form.

### One table, one card — not twenty-two more effects

`prepared-jobs.ts` is a table of job → what its form needs, plus the resolver
that turns the admin's WORDS into real values. `prepared-job-card.tsx` renders
any entry of it as a real `<form action={…}>` posting the real server action.
The two readers that shipped before this (`createTaxonomyNode` ·
`createCanonicalLeaf`) are deliberately **untouched** — changing how a shipped
reader matches is a behaviour change, not a refactor, and both are pinned by
their own guards.

🔒 **IT PREPARES, IT NEVER PRESSES.** Every value is a `defaultValue` the admin
can edit; the action runs only when they press. One-person admin plan, owner
2026-07-11 — asserted, not assumed (there is no effect and no programmatic
submit in the card, and a guard fails if one appears).

🔑 **A MISS IS SAID OUT LOUD, NEVER GUESSED.** The box only ever holds typed
words — it has no ids. An unresolved picker opens on "— choose —", stays
`required`, and a line underneath names the words that matched nothing. Copied
from the shipped category reader's posture rather than reinvented.

### 🚨 Three of the 41 would have SILENTLY WIPED a list

`setCategoryEventTypes` · `setFolderEventTypes` · `setServiceSecondaryTiles`
each read `formData.getAll(…)` for their real payload, and **that read is
invisible to the job generator**, which records single-value fields only. A card
built from the generated field list alone would have posted an **empty list** —
turning an event-scoped tile universal, or clearing a service's cross-listing —
and reported success. They are excluded, and the guard derives that rule by
looking for `getAll(` in the action body rather than trusting the prose.

🔑 **The `_id$` suffix test in the brief undercounts the problem.** `id`,
`canonical_service`, `event_type`, `faith_key`, `field_key` and `ref_key` all
name existing records without ending in `_id`. Fields are classified by what
they MEAN, not by how they are spelled.

### 🪤 The generator has a blind spot, reported not patched

Five `*LeafAttribute*` jobs require `canonical_service`, read inside the shared
`applyLeafAttributeMutation` helper. **The generator scans the action, not the
helpers it delegates to**, so that field is missing from their field lists and
the box never asks which service. Wiring them would produce a permanently
half-empty card. That blind spot spans all 185 jobs, not these five, so it is
named here rather than patched inside this change.

### The 19 left alone, each for a measured reason

**5 destructive** (a prepared card puts an irreversible act one press away from
a record matched on words — strictly worse than the confirmation flow the studio
already ships) · **3 that post a list** (above) · **3 whose form identity is a
bound argument** (`fn.bind(null, leaf.leafKey)` — not a posted field at all) ·
**3 the box never asks the key field for** (above) · **2 rendered by no form
anywhere** (giving them one is a product change) · **2 naming records the page
is never handed** · **1 that takes a photograph, which cannot be typed**.

The destructive and list-posting rules are both **derived** — from the generated
`destructive` flag and from the action bodies — so a job that becomes either
fails the build instead of quietly keeping its card.

### Where the card renders, and why that matters

Above the view switch. Four views replace the studio's whole centre pane, so
anything rendered inside one can be prepared into a pane that is not on screen —
this feature's own recurring failure, which the shipped category composer needs
a view-set and a forced view change to dodge. The card is self-contained (its
pickers carry the full lists), so it dodges it structurally and never moves the
admin off the view they were on.

### The registry stays derived, in both directions

`PREFILL_CONSUMER_JOBS` is not trusted — it is scanned out of the admin tree.
The scan now knows a second spelling, `preparedJob('<name>'`, so a name cannot
be registered without the descriptor that makes the card work, and deleting a
descriptor while the box still promises the fill fails too. **The honest
fallback is untouched**: for the remaining 161 form-driven jobs the box still
says the page does not fill itself in yet, lists the fields, and offers to open
it.

🛡 **29 assertions · 15 mutations, every one printed before → after and every one
RED** — including two aimed at the guards' own floors, because a scan that
cannot match is not a negative result. No file under `app/admin/ugat/`,
`lib/ugat/` or the command palette was touched.

SPEC IMPACT: None (admin console wiring; no SKU, price, schema or migration).
