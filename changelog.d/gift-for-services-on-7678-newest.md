## 2026-11-18 · fix(gifts): gift for services sits on #7678's newest bundles migration

`origin/main` and #7678's newest head are merged in. The agree-time gift migration moves to `20271351642481`, past #7678's re-allocated bundles migration (`20271351048946`). Its copy of `shop_gift_deliver_for_booking` now keeps #7678's "a gift given before packs were counted is never given twice" guard. Without the merge, the older copy would have removed that guard, and `a-supplier-gift-lands-once` test 9 goes red. It also carries `shop_gift_smallest_papic_pack()`, unchanged and read from the catalogue, because #7678 no longer creates it and this door is its only caller. The two Black Diamond functions it re-creates differ from main only in comments.

SPEC IMPACT: None.

Main's own-client gift step (`own-client-gift.tsx`, `lib/own-clients.ts`) still read the retired gift price (`giftUnitPrice`, `paysGiftPrice`), which #7678 removed. It now shows each gift at its catalogue list price (`srpCentavos`), as #7678 rules. It counts its stock in a per-kind `KindCounts`, because it never reads #7678's per-pack counts. The full typecheck is clean.
