## 2026-11-08 · feat(supplier): Build 2 lane B2-B — Shop + Portfolio (rows #31 #32 #33 #35 #40 + stories couples published)

The Shop and Portfolio tabs move closer to v118, extending lane C4's shipped parts (no screen redrawn):

- **#31 No loose rows on the Shop page.** The "Your page / Your details" rows under the cover are gone. Your page is now
  the Shop ⚙'s first row ("What couples see, part by part · all your reviews inside"). Your details stays where it already
  was, in the top-right account sheet. The cover's "★ 4.8 · N reviews" links to Your page › Reviews
  (`/vendor-dashboard/website#reviews`). The `#d1` anchor still resolves, so old links keep working.
- **#32 Every badge sits in a progress ring.** This uses the shipped `app/_components/progress-ring.tsx` with a new
  opt-in `sweep` prop. A ladder fills toward its next tier, an earned one-off is full, not-yet is empty, rating is avg/5,
  and an unread badge shows an empty ring. Colour depends on the group. The ring draws in once on view, staggered, and
  stays static under reduced motion. Pure logic is in `lib/badge-ring.ts` (tested).
- **#33 Makers = one row of tiles that open INTO THE BODY.** The Forms Maker shows C3's Form Maker shop-wide
  (`ShopFormsMaker`); its body is read only while `?maker=forms`. The Scanner keeps the shipped `ServiceScannerPick` per
  service. The new shared `BodyPanel` sits between the top bar and the bottom nav. It grows out of the tile over 520 ms
  using the house rise ease, shrinks back into the tile on ×/Escape, and holds the page's exact scroll. Reduced motion
  gets a 120 ms fade. It uses the pop layer token. No Tools Maker (spec §9 #8).
- **#35 Portfolio in three groups:** All your events (the private Papic album per booked event) · Your services (each
  card's photos) · Inspiration you curated (approved looks per part, plus the "Add to the inspiration library" row, moved
  here from Shop). Then Stories couples published, All photos (newest first), and Video links. Video links are edited
  row by row (Link · Remove · Save), ▶ plays them in a pop-up player, and "Add another link" adds more. No new table:
  every group reads a store that already exists, and video links are the shipped `gallery_video_links`. Pure logic is in
  `lib/portfolio-groups.ts` (tested).
- **#40 An opened album pins and fills the body.** Albums open through the same `BodyPanel` as the Makers, as a 3-column
  grid with a "+N" tile that links to the album's own page when it has one. The ✓ still picks an album for Show.
- **Parity: Stories couples published** is listed in Portfolio from `loadVendorFeaturedStories`, the same read that
  Promote › Share your work uses.

Guards: new `app/vendor-dashboard/_components/the-body-panel-keeps-the-navs.test.ts` (sabotaged once per claim). Updated
honestly, each with its ruling cited: `shop/the-shop-tab-is-v113.test.ts`, `lib/my-shop-doors-keep-every-control.test.ts`,
`lib/every-palette-part-reaches-the-supplier-library.test.ts`. New unit tests: `lib/body-panel.test.ts`,
`lib/badge-ring.test.ts`, `lib/portfolio-groups.test.ts`.

SPEC IMPACT: None. This builds rows already ruled in `plans/supplier_build_2_2026-11-08/00-BUILD-2-PLAN.md` and
`plans/supplier_one_build_2026-11-08/00-ONE-BUILD-SPEC.md` §10. One spec path is stale: §10 #32 cites
`performance/_components/progress-ring.tsx`, but the shipped ring is `app/_components/progress-ring.tsx`. That is noted
in `build-notes/supplier-build2-b.md` for the controller and is not edited here.
