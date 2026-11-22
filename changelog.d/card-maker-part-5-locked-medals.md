## 2026-11-19 · feat(supplier-badges): Card Maker part 5 — locked medals in their real art, a small lock bottom-right

Owner 18 Nov (Card Maker v36, "The medals on the card"): *"we still want to see how they look like"*. A badge or
medal not earned yet is now drawn in its own colours, the same size, with a small lock at the bottom-right. The shelf and
the sheet got that look in #7986; this PR adds it to the service list. Supplier screens only; a couple's card never shows a locked medal.

- **Shop › Badges** and **the locked sheet**: that look (colours kept, a small lock on the corner) already shipped on main in #7986. This PR changes neither file.
- **Shop › Services**: under each card's earned medal row, the medals it can still earn
  (`CardLockedMedals`, new), e.g. "Trending Now · Locked". Only on an honest badge read; an unread set draws nothing.
- Guard `lib/card-locked-medals.test.ts`: only `app/vendor-dashboard/**` (and the dev labs) may import
  `CardLockedMedals`; the shelf and the sheet never grey a badge.

No schema, no new read, no new server action. Motions: none added or removed.

SPEC IMPACT: None — implements the 18 Nov ruling already recorded in the Card Maker v36 drawing.
