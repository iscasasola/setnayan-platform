## 2026-11-18 · fix(gifts): an old extended gift never crowds a new waiting gift off Today

`readShopGifts` reads at most 20 rows, and the running-gift branch of its filter matched every finished 'extend' gift for ever (those never get `finished_at`). It now also requires days still on the clock, the same test the code applies to it afterwards, so a new gift is never pushed past the limit. Opus review #7674, finding 2.

SPEC IMPACT: None.
