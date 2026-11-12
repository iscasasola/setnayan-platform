## 2026-11-12 · feat(for-suppliers): each plan card shows that plan's shop page — a miniature that rises full screen

Ruling 5735 (owner-approved 13 Nov 2026; corpus `prototypes/plan_previews_2026-11-13/index.html`). /for-suppliers
§ 13 · PLANS keeps everything as shipped and adds ONE row at the foot of the Free card, the Verified card and each
Solo / Pro / Ultra Grow tab panel (so it switches with the tab): a 3:4 miniature (112 × 149) of that plan's shop page +
"Your page on <Plan> · What couples see · <caption> · Open ›".

- **One drawing.** `app/v/[slug]/_components/sample-shop-page.tsx` (`SampleShopPage`) mounts the real card-column pieces
  of `/v/[slug]` (`ShopReachLine` + `ShopReachMap`, `ShopAddresses`, `PinnedReviewCard`, `ShopBadgePill`,
  `NotYetVerifiedNotice`) and decides every plan difference with the page's own rules (`shopReach` / `ownWebAddress` /
  `pinnedQuote` over `tierCaps`, `micrositeCan`, `micrositeAccentVars`). `/dev/shop-plan-lab` now renders it too, so
  the lab and the plan cards cannot drift. The miniature is that drawing at 390 px scaled to 112 px; the full-screen view
  is the same node. Sample data, wearing the "(DEMO ONLY)" chip (the retired "Sample shop" label stays retired). Branches ("Also in …") are NOT drawn — open owner question.
- **The motion.** A tap lifts the page full screen with the house rise (`lib/rise-motion.ts`, 0.7 s on `--sn-ease-rise`,
  a 120 ms cross-fade under reduced motion) from the miniature's own box, under a floating pill bar with ‹ Back (44 px).
  ‹ Back, Esc, the scrim and the browser's back close it with the exact reverse. `useModalA11y` carries focus + scroll lock.
- **Cheap.** Server HTML, no new library; maps load lazily; a closed Grow tab's miniature is `hidden`.

SPEC IMPACT: None — builds the approved prototype; no decision changed.
