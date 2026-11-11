## 2026-11-11 · fix(discover): the shop card wears the circular image badges, not the long pill

Owner 11 Nov, on Discover's "The first shops": *"badges are wrong. we have the circular badges already."* The shop
card drew its up-to-2 badges with `ShopBadgePill` (the long gold-edged pill). It now draws each with `ImageBadge` —
the seal / hex / rosette pictures the Shop tab's badge row already uses — via a new pure `badgeImageOf` in
`lib/shop-badge-row.ts` (Verified → navy seal ✓ · milestone → events hex in its step's material · rating → gold seal
with the average · years → ivory seal with the years · award → monthly rosette). Which badges a card wears is
unchanged (`cardBadges`: up to 2, Verified first). Guard updated in `the-shop-card-wears-the-shop.test.ts`.

SPEC IMPACT: None in code rules — the DECISION_LOG "DISCOVER'S SHOP CARD — APPROVED" (10 Nov) line naming
`ShopBadgePill`s is superseded on the drawing only (owner 11 Nov); the "up to 2, Verified first" rule stands.
