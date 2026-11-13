## 2026-11-13 · feat(front-pages): the sample shop page IS the shipped shop page — /for-suppliers, /for-coordinators, the plan lab

Step C of the three approved public pages (DECISION_LOG 13 Nov "THREE PUBLIC PAGES APPROVED — AND THE FRONT PAGES
FOLLOW": *"also adapt the frontpages that shows a sample page and where the websites are presented"*). The shop page
(#7574) and person page (#7573) are live; the front pages still drew an older, plan-ladder copy of the shop page.

- **`SampleShopPage` is rebuilt from the pieces `/v/[slug]` ships**, not redrawn: verified (every verified plan alike) →
  `ShopHero` with the circular Verified seal + `SealCaption`, the raised calling card (`SHOP_CALLING_CARD_CLASS`) with
  the open-dates peek (`OpenDatesPeek`, on sample Saturdays from the shipped `nextSaturdays`), Inquire · Add to your
  event · Check a date · Share in the page's order, the reach map and addresses, then `ShopSectionBar`
  (About · Services · Reviews) and the "What their own website can't do" panel (`ShopCanDoPanel`). Free → the calm
  column under `NotYetVerifiedNotice`, Services · Reviews · Where, the pin under Where, no date check, no web address.
  Retired with the old copy: the Ultra-only hero with its own Inquire on the photo and the Pro-only cover band (the
  owner's "two looks" made the hero every verified shop's). What still differs by plan is read from the same rules as
  before (reach, own address, pinned review, About + accent, card count, branches); the miniature captions say it.
- **Who gets it:** the /for-suppliers plan-card miniatures and their full-screen view, `/dev/shop-plan-lab` (now a
  430 px column, the width the cards show), and — new — **/for-coordinators "Your page is your marketing tool"**,
  which gains the same miniature row (Verified page, opens full screen) instead of describing the page in words only.
- **Small extensions to shipped pieces, the shop page unchanged:** `ShopHero frame="sample"` (name as a paragraph —
  the host page owns its headings —, no photo preload, phone sizes at any width); `ShopSectionBar` jumps, tracks and
  returns ↑ Top inside the scrolling sheet it sits in (falls back to the window, as on the shop page) and takes a
  `topId`; `CheckADateLink` / `OpenDatesPeek` / `ShopCanDoPanel` accept `checkHref={null}` (the door drawn, nothing
  to open); `PinnedReviewCard` takes `reviewsHref`; `PlanPagePreview` takes `ownTokens` so the row carries its colours
  on another page. The sample's plan rules moved to a pure `sample-shop-plan.ts` (re-exported; tests read it without CSS).
- **Not changed:** the front-door shop card (`front-door-feed.tsx` `ShopCard`, approved 10 Nov as a card, not a page —
  it already uses the shop page's cover rule and circular badges) and `frontdoor/data.ts` (it already resolves covers
  with the shop page's own `shopCoverKey` + `heroPicture`). Nothing touched in the `/` and `/login` bundle work (#7599).
- Guard: `app/v/[slug]/the-sample-is-the-real-page.test.ts` — the sample imports and draws each shipped piece (and the
  page still draws it), the look follows `verified` not a plan, one Inquire and no links in a drawing, per-plan ids,
  /for-coordinators mounts it, the section bar's scroller rule. `the-lab-never-ships.test.ts` reads the rules module.

Shots (390 px, Now beside Proposed): `build-sessions/shots-front-pages/`.

SPEC IMPACT: None — implements the 13 Nov owner ruling already in DECISION_LOG.
