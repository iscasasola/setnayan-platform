## 2026-08-15 · fix(search): the public search box now finds the stories and guides it promises

The search box on every public doorway has read **"Search suppliers, stories and
guides"** since the day it shipped, and its form goes to `/explore` — the supplier
marketplace, which had **zero** references to any article, story or help source.
Two of its three nouns had no code path behind them at all.

**Measured on the live site 2026-08-15**, not inferred: `/explore?q=doves` answered
*"No vendors match exactly"* while `/blog/release-of-doves-filipino-wedding`
returned a live, sitemapped page.

🔑 **THE FAILURE IS SILENT BY CONSTRUCTION.** Nothing throws when a promised noun
has no source — the page renders, the query runs, and the visitor is told there is
nothing. That is indistinguishable from *"we have no articles about doves"*, which
is why it survived. Same family as the phantom column · enum value · RPC argument ·
blocked iframe · unresolved `r2://`: **the only symptom is an absence.**

🔑 **IT IS A RESTORATION, NOT A NEW FEATURE.** The owner-approved binding drawing
(`prototypes/front_door_and_seam_2026-08-12.html`) has a search returning THREE
labelled groups — *01 · Suppliers*, *02 · Studio*, *03 · Articles*. The port kept
the three-noun placeholder and shipped one group. This restores the group that was
dropped. It does **not** reverse the 2026-08-14 "one bar, one search" decision:
that decision is scoped, in its own words, to the signed-in app variant, and is an
engineering judgement rather than an owner lock.

⚖ **WHY NOT SIMPLY FIX THE WORDS.** Prod holds **zero** shops that are both
approved-to-show and published, so a suppliers-only box returns nothing to every
visitor for every word — while **34 published guides and 74 help pages** sit
unreachable. Narrowing the promise would have shipped an honest dead control on six
public pages.

🛡 **THE PROMISE IS NOW DERIVED, NOT RE-TYPED.** A guard comparing two hand-typed
strings is not a guard (this repo has paid for that twice). The placeholder is
BUILT from `PUBLIC_SEARCH_NOUNS`, and the resolvers derive their covered nouns from
the source list itself, so a noun cannot be promised with nothing behind it without
a red test.

🪤 **AND ONE OF MY OWN NEW GUARDS WAS DECORATION ON ITS FIRST RUN.** The
"a title match outranks a body match" test PASSED with the title weight sabotaged
to equal the body weight — the exact-phrase bonus was doing all the work, so a test
named for the title weight proved nothing about it. Re-written with out-of-phrase
tokens. **8 sabotages, every one verified to land by occurrence count (1 → 0), all
8 now turn the suite red; baseline and post-restore both green.**

⚠ **A NOTE ON THE SPLIT.** `server-only` is not an installed package in this repo,
so a unit test importing a module that declares it dies with `MODULE_NOT_FOUND`
before a single assertion runs. The matching and the in-code corpora therefore live
in a neutral `site-search-core.ts` (fully tested) with the database half in
`site-search.ts` — the shipped `review-fraud-scoring` / `review-fraud-screener`
pattern.

🔒 **The marketplace query is untouched** — no change to which vendors match or
their order — and the reading results render BELOW the vendor results, never above.
Stories come from the same already-public loaders `/realstories` uses, so nothing
unpublished, unconsented or unfeatured can enter a result; a curated sample is
labelled as one.

**Files:** `apps/web/lib/public-search-nouns.ts` (new) ·
`apps/web/lib/site-search-core.ts` (new) · `apps/web/lib/site-search.ts` (new) ·
`apps/web/lib/site-search-core.test.ts` (new, 15 tests) ·
`apps/web/app/explore/page.tsx` · `apps/web/app/_components/frontdoor/front-door-shell.tsx`

SPEC IMPACT: None. No decision changes — this makes shipped copy true and restores
an already-approved drawing. Prices, SKUs and locked decisions untouched.
