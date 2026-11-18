## 2026-11-17 · fix(badges): Shop › Badges, its pop-ups, Today's earned line and the prints wear the approved v84 badges

Owner, on live after 17ecd12: *"i still see old badges?"* · *"old pop ups of badges"* · *"Prints did not use Setnayan Verified badge"*. DECISION_LOG 15 Nov "THE BADGES IN THE APPROVED PROTOTYPE ARE THE ONLY BADGES".

- **The approved art ships as static files.** The 35 tier pictures of `prototypes/supplier_badges_2026-11-15/badge-milestones_v84.html` (`IMG`, 5 badges × 7 tiers, 300 × 286 webp, 524 KB in all) go to `apps/web/public/badges/v84/<family>-<tier>.webp`. They load lazily at a fixed size, so the JS bundle does not change. The v84 Setnayan Verified (the plain blue circle with the check) is copied verbatim as vector in `lib/verified-v84-art.ts`, with only its ids made unique.
- **Shop › Badges is the approved shelf** (`lib/shop-badge-shelf.ts`): Setnayan Verified plus Completed bookings · Five-star reviews · Gifts given · Trusted by · Invites, counted by the reward engine's own reads (`readBadgeRewardFacts`). The retired tiles are no longer drawn: Events, Reviews, Service cards, Inspiration box, Branches, Booked Loop, the Firsts, Rating, Business since, Monthly awards. Invites says "Not counted yet".
- **Tapping a badge opens the award kit**:
  - an earned badge opens `BadgeFullscreen` (it flies out of the row, bursts and plays its tap show);
  - Verified opens `VerifiedFullscreen`;
  - a badge not earned yet rises with the v84 locked look (`LockedTile`).
  - The old sheet's Now · progress · next goal · reward · how-it-counts lines all carry over (`shelfLines`).
- **Today's earned line** announces only Verified and the five badges' tiers, from the award queue (`awardNews`, `lib/badge-earned-news.ts`), with the v84 art and "See it". It never announces a retired badge.
- **Prints:** the Verified circle in the badges print file, in the supplier prints' pills and in the small pieces' "Setnayan Verified" line is now the v84 blue check (vector). The door sticker's PDF gets it in flat inks. It still shows only when the shop is verified.

SPEC IMPACT: None
