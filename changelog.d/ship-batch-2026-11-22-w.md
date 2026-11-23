## 2026-11-22 · ship(batch-w): six supplier fixes in one train

#8161 the two older quote doors refuse an unverified shop · #8162 a couple's inquiry never says "Sent" when it was not sent · #8154 sign-in starts on the profile page; the phone sign-in sheet · #8091 the thumb-row search icon sits dead centre and grows from the icon · #8169 Shop › Analytics, every card one shape · #8171 shop share card v2 (cover photo, logo + seal, proof).

Ship controller: #8171 met main's "Free files stay private" (spec ★ J) in the link-preview route. The card's cover photo now follows the same `OwnShopServe` as its logo, so an unverified shop's share card draws no photo of theirs; the guards in `lib/free-shop-files.test.ts` and the link-preview test hold it. Generated files regenerated once for the batch (screens map, port baseline, admin jobs); the exposure surface is unchanged.

SPEC IMPACT: None
