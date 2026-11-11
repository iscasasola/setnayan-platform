## 2026-11-11 · fix(card-checks): the full claim-word list is seeded — "best" and the 8 Nov list are refused

Owner 11 Nov, on a live card named "Best mobile bar": *"I thought we already did the prohibited words to use like best."*
The 8 Nov ruling banned the full list, but production held only the first six (#1 · 100% · best in · guaranteed ·
lowest price · official). A data-only migration seeds the ruled list (Rank · Popularity · Promise · Pressure · Tagalog ·
Setnayan's earned badges), plus plain "best", into `card_claim_words` with ON CONFLICT DO NOTHING, which leaves 50 rows
in the list. The card maker's live check and the save's server re-check already read this table, so nothing else
changes. Matching is whole-word, so "bestow" still passes.

Still open from Build 2's fair-presentation item, not in this PR: disguised forms (N0. 1 · b e s t), no emoji, the
check on shop name, tagline, packages and About, the 18 checks, and the one sweep of live cards.

SPEC IMPACT: None. This applies DECISION_LOG 2026-11-08 "NO CLAIM WORDS IN ANY SUPPLIER-WRITTEN NAME" as ruled.
