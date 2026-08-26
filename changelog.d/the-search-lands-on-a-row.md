## 2026-08-26 · feat(admin): the search lands on a price row, not the top of the catalogue

The owner's first sentence was *"take me to the pricing for papic services"*, and
the drawn prototype answers it by landing on the Papic **rows**. The scanned route
map indexes pages; a page's rows live in the database, so they cannot be scanned
from the tree. This adds them.

| typed | before | after |
|---|---|---|
| `papic 3000 shots` | nothing | **Papic — add 3,000 shots**, scrolled to |
| `papic prices` | nothing | Pricing, then every Papic row |
| `PAPIC_GUEST_10K` | nothing | that row |
| `pricing` | Pricing | Pricing *(unchanged)* |

**Bands, so a row can never shadow a screen.** The curated menu scores at full
strength, a scanned page at half, a row at a third. A row wins only when its own
words are what you typed — ask for "pricing" and you still get the page that
edits all of them.

🔑 **The link and the element it points at come from ONE helper.** A href written
in one file and an `id` typed in another is this repo's recurring
two-hand-typed-things failure, and here it has the quietest symptom in the
family: the link works, the page opens, and it simply never scrolls. Guarded, and
mutation-proved by hand-typing the id.

🪤 **The helper had to become its own leaf.** It first lived beside the database
reader — and the price-row editor is a `'use client'` component, so importing it
would have pulled the service-role Supabase client into the admin browser bundle.

⚠ **This reader is NOT `fetchV2CustomerCatalog`, deliberately.** That one hides
`is_active = false` and name-excludes SKUs because it feeds the public price
page. Reusing it would have hidden **17 of the 22 Papic rows** from the person
whose job is to edit them. Retired rows are included and labelled *off sale*.

**Guards** — 8 assertions, 8 mutations, all RED after two fixes. 🪤 **One of mine
was decoration**: mutating the palette's row band changed nothing any test could
see, because the tests score with a *copy* of the palette's scorer — the copy's
drift guard was one band short. 🪤 **Another failed on a comment**: the module's
own docblock names `fetchV2CustomerCatalog` to explain why it does not use it, so
a raw-source match reported the very defect the comment exists to prevent. Strip
comments before matching — the house rule, paid for again.

SPEC IMPACT: None. No schema, no pricing change, no product surface.
