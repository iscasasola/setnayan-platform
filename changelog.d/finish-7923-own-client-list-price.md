## 2026-11-18 · fix(gifts): the own-client gift step on #7678's list price (gift store branch)

Main's own-client gift step still read the retired gift price (`giftUnitPrice`, `paysGiftPrice`), which #7678, this branch's base, removed. It now shows each gift at its catalogue list price (`srpCentavos`), and counts its stock in a per-kind `KindCounts`. This is the same change as on #7823.

SPEC IMPACT: None.
