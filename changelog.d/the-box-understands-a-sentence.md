## 2026-08-26 · fix(admin): the search box answers a sentence, not just a word

The owner asked for a box he can talk to. Measured against shipped code, two
words were already enough to break it:

| typed | before | after |
|---|---|---|
| `pricing` | Pricing | Pricing *(unchanged)* |
| `papic prices` | **nothing** | Pricing · Papic storage |
| `show me the prices of papic` | **nothing** | Pricing · Papic storage |
| `take me to the pricing for papic services` | **nothing** | Pricing · Papic storage |
| `i want to add a new category on the taxonomy service` | **nothing** | Taxonomy |
| `who is waiting to be approved` | **nothing** | Approvals · Completions |

**The rule, and why it is this one.** Sort by TODAY'S whole-string score
**first**, and use the per-word evidence only to break ties and rescue queries
that score zero. That ordering makes the change **additive by construction** —
and it is proved, not argued: a guard runs every one of the ~900 words the admin
knows through both the old and new algorithms and fails if a single one
re-orders. The palette's own `score()` and its 100 / 60− / 15 / 8 bands are
untouched, which is what makes that proof meaningful.

**An unknown word is reported, never silently dropped.** The palette now says
*"No page has the word 'want'"* above the results. Without it the box lies by
omission: a query resolves on the words it did know and opens a confident
near-miss.

**RULE 0 again — the tokenizer already existed.** `lib/site-search-core.ts` has
a tested stop-word list and splitter, written for the public site when *"cancel
my order"* returned nothing. The palette **cannot import it** — its first two
lines pull in the blog and help corpora, which would land in the admin's client
bundle — so the list moved to a leaf module both read. 🪤 A bare
`export … from` re-export does **not** bind the name inside the module: the
public search's own tests failed instantly with `searchTokens is not defined`.

**The phone got the identical fix, and this is the third time that has mattered.**
`more-search.tsx` tested `hay.includes(query)` — the whole typed string — so a
sentence hid **every** card on the one device the owner reports from. Its
haystack had also fallen behind the laptop's while a comment above it claimed
they were identical. Both now read the same source, and the rule lives in a
shared function so a guard can **execute** both surfaces on one query instead of
comparing source text, which is what the existing parity guard does.

**Two words added to the alias list, under that list's own rule** (*"add a word
only after someone actually typed it and found nothing"*): `prices` and `papic`
on the Pricing entry. Measured why — the plural `prices` appeared in **zero**
admin haystacks (there is no stemmer in this repo) and `papic` in exactly one
page, which is not the money. Both are true of that page: every Papic SKU is a
row in that catalogue.

**Guards** — 9 assertions, 9 mutations, all RED. 🪤 **Two of my own were caught
only by measuring.** One asserted a stray `"a"` was dropped — but `a` is a stop
word, so it was dropped for a different reason and removing the two-character
minimum stayed GREEN. Hardening it then exposed **a real bug in my own ranker**:
it skipped the word evidence when a query tokenised to one word, so `"s pending"`
— the stray letter dropped — fell back to matching the raw string and answered
**nothing**. There is no "is this a sentence?" shortcut any more.

SPEC IMPACT: None. No schema, no pricing, no product surface.
