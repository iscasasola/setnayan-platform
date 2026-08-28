## 2026-08-28 · feat(taxonomy): one trade, many names — a reviewed alias list, mined from our own data (C2)

"sorbetes", "sorbetero" and "ice cream cart" can now find a live trade even when the word never
appears in the trade's own label. Adds `canonical_service_aliases` (phrase → canonical_service,
UNIQUE on the normalised phrase, RLS-gated to reviewed rows only) and `/admin/taxonomy/aliases`,
the review screen that turns a proposal into something the maker's search can actually use — an
unreviewed alias answers nobody.

🛑 CORRECTED MID-STREAM, owner: *"when we do not have data yet, do not recommend. collect first."*
then *"initially, we already have a target service for each category. that is our initial data."*
The first cut of `scripts/seed-trade-aliases.ts` asked Claude for synonyms; it does not any more.
It now MINES words deterministically from `canonical_service_schemas.category_specific_attributes`
— the enum/multi_select option values every category's own attribute form already carries
(`photo_booth.booth_types` already lists "360 booth", "gif booth", "polaroid instax"). No model
call, no network, no key required. The `written_by` column is renamed `source`
(`'mined' | 'collected' | 'proposed'`) to describe HOW a phrase was obtained, since that is now
the real distinction — 'collected' (real supplier confirmations) and 'proposed' (asking a model)
stay reserved for later, unbuilt slices.

Two filters decide which option values are distinctive enough to keep, both counted and reported
by the script, neither hand-tuned per word: a named stoplist of generic size/degree/boolean
descriptors ("small", "medium", "large" — `photo_booth.footprint_size`'s own options, explicitly
why this filter exists), and a measured cross-category-sharing ceiling (a word appearing as an
option on 6+ unrelated categories, like "english"/"tagalog"/"both", is describing the shape of a
question rather than one trade — the real data has a clean gap between 5 and 10 categories, and a
legitimate small related cluster like "silk"/"jusi"/"pina" on the 4 barong/filipiniana categories
correctly survives). See `lib/trade-alias-miner.ts`'s docblock for the full reasoning, verified
against a live production read.

Real (not simulated) coverage, read out of production 2026-08-28: 169 of 276 categories carry a
real attribute schema; 151 of those mine at least one surviving word after both filters; 1,455
words kept (1,232 distinct) from 1,539 raw option values (38 dropped as generic, 46 as
over-shared). 107 categories have no attributes at all yet and mine nothing — expected, not a
defect; fill arrives with real suppliers, not by tuning this pass. Framework shipped, not
coverage-gated.

`lib/taxonomy-search-rank.ts`'s shared ranker gained an optional `aliases` field on
`RankableOption`, scored by the SAME four-tier rules as the label (refactored from an if/else-if
chain to an equivalent `max`, pinned byte-identical for every option with no `aliases` set).
`lib/kind-search-trades.ts`'s `TradeMatch` carries the same field, resolved through C0's
merge-forward map (`service-merge-forward.ts`) at read time in
`/vendor-dashboard/services/new/page.tsx`, so an alias whose trade was later merged or retired
follows the forward or drops silently — never renders a stale trade.

29+ mining/wiring tests plus the pre-existing ranker/resolution suites, every guard mutation-
verified (occurrence count printed before → after, each shown red): dropping either mining filter,
widening the `source` CHECK constraint, re-adding an Anthropic import/call to the script, and
writing the wrong `source` value were each independently caught.

SPEC IMPACT: None — extends the already-planned category suggester (`WHATS_NEXT_The_Category_Suggester_2026-08-28.md`, slice/session C2). No new data processor, no privacy-notice change — the seeding script now makes no external call at all.
