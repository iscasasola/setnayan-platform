## 2026-08-28 · feat(taxonomy): one trade, many names — a reviewed alias list for the card maker's search (C2)

"sorbetes", "sorbetero" and "ice cream cart" can now find a live trade even when the word never
appears in the trade's own label. Adds `canonical_service_aliases` (phrase → canonical_service,
UNIQUE on the normalised phrase, RLS-gated to reviewed rows only), a `scripts/seed-trade-aliases.ts`
offline script an admin runs to ask Claude for Filipino/English/Taglish synonyms per trade
(written UNREVIEWED), and `/admin/taxonomy/aliases`, the review screen that turns a proposal into
something the maker's search can actually use — an unreviewed alias answers nobody.

`lib/taxonomy-search-rank.ts`'s shared ranker gained an optional `aliases` field on
`RankableOption`, scored by the SAME four-tier rules as the label (refactored from an if/else-if
chain to an equivalent `max`, pinned byte-identical for every option with no `aliases` set — see
the new tests). `lib/kind-search-trades.ts`'s `TradeMatch` carries the same field, resolved through
C0's merge-forward map (`service-merge-forward.ts`) at read time in
`/vendor-dashboard/services/new/page.tsx`, so an alias whose trade was later merged or retired
follows the forward or drops silently — never renders a stale trade.

Eval (hand-authored aliases standing in for a live model call — no ANTHROPIC_API_KEY in this
session, see `lib/service-trade-aliases-eval.test.ts` for the full honesty note): against the
51-trade "no word of their own" batch from `SERVICE_CARD_VOCABULARY_MEASURED_2026-08-28.md`,
letters-only search finds 18% of realistic short supplier queries; with the alias list attached,
100% — though that number is against a non-blind, self-authored set, not proof of real-supplier
coverage.

10 pure/behavioural + 10 wiring tests, all mutation-verified (measured occurrence count before →
after, each mutation shown red): dropped `aliases:` attachment, opened the RLS read policy,
reject-also-approves, seed script writing `reviewed_at`, and reverting the ranker to drop alias
scoring were each independently caught.

SPEC IMPACT: None — extends the already-planned category suggester (`WHATS_NEXT_The_Category_Suggester_2026-08-28.md`, slice/session C2). No new data processor, no privacy-notice change (the seeding script runs offline, admin-triggered; no supplier text is ever sent to a model).
