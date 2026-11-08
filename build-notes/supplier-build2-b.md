# Build 2 lane B2-B — Shop + Portfolio · build notes

Branch `claude/supplier-build2-b`, cut from `origin/claude/supplier-1build` (0848ff58db). Spec: Setnayan-specs
`plans/supplier_build_2_2026-11-08/00-BUILD-2-PLAN.md` rows #31 #32 #33 #35 #40 + parity "Portfolio stories couples
published"; `plans/supplier_one_build_2026-11-08/00-ONE-BUILD-SPEC.md` §10. Contract: prototype v118 at 375 px.
Lab: `/dev/supplier-lab?s=shop-tab` · `?s=portfolio-tab` (`&unread=1` = every read refused; `&gear=1` opens the Shop ⚙).

## RULE 0 — what existed · what was missing · the delta
| Row | Existed (extended, not redrawn) | Delta |
|---|---|---|
| #31 | C4's `shop/page.tsx` door rows, `shop-settings-rows.tsx` (⚙), `shop-cover.tsx` ★ line; Your details already in the account sheet (`supplier-avatar-rows.ts` key `details`) | Door `<ul data-shop-doors>` removed; Your page = ⚙'s FIRST row (`data-shop-gear-page`, `YOUR_PAGE_HREF`); "★ 4.8 · 38 reviews" → `/vendor-dashboard/website#reviews` (`page-parts.tsx` `<Fold anchor="reviews">`). Old `#d1` anchor kept. Tour anchor `shop-details` moved onto the cover. |
| #32 | `app/_components/progress-ring.tsx` (spec cites `performance/_components/progress-ring.tsx` — stale path), C4's `shop-badge-row.tsx`, `lib/shop-badge-row.ts` ladders | Opt-in `sweep` prop on ProgressRing (default unchanged); `lib/badge-ring.ts` (pct + group colour + stagger); each `ImageBadge` sits in an 84 px ring, draws in once on view (IntersectionObserver), reduced motion = static (global CSS). |
| #33 | C4's `shop-makers.tsx` (Scanner sheet + Forms door), C3's Form Maker (`forms-page-body.tsx`), `lib/rise-motion.ts`, z tokens | NEW shared `_components/body-panel.tsx` + pure `lib/body-panel.ts`; Makers = ONE row of tiles (Forms Maker · Scanner) opening into the body; Forms Maker body = `ShopFormsMaker` (extracted `FormsLibraryList` + ＋ New form + `FormMaker`, shop-wide) drawn by the server only while `?maker=forms` (`shop-forms-body.tsx`). No Tools Maker (§9 #8). |
| #35 | `collections-data.ts` reads (Papic album rows, card photos, moodboard access), `loadVendorFeaturedStories`, `fetchShopInspirationLooks`, `fetchVendorPoolBookings`, `vendor_profiles.gallery_video_links` + `updateVendorProfileField('gallery_videos')`, `parseVideoLink` | `lib/portfolio-groups.ts` builders; `collections/_components/portfolio-groups.tsx` (3 groups + Stories + All photos + Video links row-by-row editor); `GalleryMedia videosHere={false}` on Portfolio (one editor per column per screen). **No new table, no migration.** |
| #40 | C4's `CollectionsList` open-in-place | Group albums open through the SAME `BodyPanel` (3-col grid, ≤ 24, "+N" → the album's own page when it has one); ✓ still picks for Show. Collections below keep C4's open-in-place (they are not "albums" of the three groups). |
| Stories | `loadVendorFeaturedStories` (Promote › Share your work's read) | Listed in Portfolio, each → `/<slug>`, plus "Share them" → `/vendor-dashboard/shop/promote#share`. |

## Done
- All six rows built; unit tests `lib/body-panel.test.ts` · `lib/badge-ring.test.ts` · `lib/portfolio-groups.test.ts` (17 pass).
- New guard `app/vendor-dashboard/_components/the-body-panel-keeps-the-navs.test.ts` — sabotaged once per claim
  (z-sn-pop → z-50 failed 1 · RISE_MS → 600 failed 2 · `<BodyPanel` removed from portfolio-groups failed 4), reverted.
- Guards updated honestly, ruling cited in each: `shop/the-shop-tab-is-v113.test.ts` (order without doors, doors pinned
  ABSENT, Makers tiles + Forms body pinned) · `lib/my-shop-doors-keep-every-control.test.ts` (Your page = ⚙ first row,
  Your details in the account sheet, ★ → #reviews) · `lib/every-palette-part-reaches-the-supplier-library.test.ts`
  (library row: Shop 0×, Portfolio exactly 1× under Inspiration you curated, same live-parts predicate). Each updated
  assertion sabotaged once and seen red.

## Request counts
Measured in the lab at 375 px (dummy env, Next dev overlay hidden; counts = non-bundle requests):
- **Shop tab load:** 3. **Scanner open + close: 0** (it no longer writes the address — the first walk caught it re-drawing
  the whole Shop on the server via `?maker=scanner`; now only the Forms Maker writes `?maker=forms`, guarded in
  `the-shop-tab-is-v113.test.ts` test 3, sabotaged once). **Forms Maker open: 1** (the RSC that draws its body).
- **Portfolio tab load:** 13 (the 10 lab photos + document; 12 with `&unread=1`). **Album open + close: 0** (already-signed
  URLs). Scroll position held to the pixel on close (Makers 366 → 366).
- **Real page, added server reads:** Shop — none on load (the inspiration-library access read moved to Portfolio); Forms
  Maker reads only while open. Portfolio — one `Promise.all` wave adds pool bookings (1, shared by album titles and
  stories) → featured stories (1, chained), approved looks (1, admin; skipped when the library refuses the shop), Papic
  capture flag (1); album signing is a local presign (`getSignedUrl`, no R2 round-trip), ≤ 24 per event.

## NEEDS (controller / owner)
- **Video link titles:** v118 draws a Title field per link; the shipped store is `gallery_video_links text[]` (URLs only).
  A row is named by its platform ("YouTube video"). A title needs a stored column — owner/controller call (not built,
  no migration).
- **Tools Maker** waits on #7006 + a ruling (spec §9 #8); the tile row is as wide as its tiles (2).
- **Spec path:** §10 #32 cites `performance/_components/progress-ring.tsx`; the shipped ring is
  `app/_components/progress-ring.tsx`.
- **Forms Maker count:** v118's tile says "5 saved"; the tile says "Sent as a chat card" so the Shop tab pays no forms
  read on load. Add the count only if the owner wants the extra read.
- **Duplication (owner call):** Portfolio now shows "Your services" (card photos) AND the shipped "Service card photos"
  collection row below; likewise the Papic album collection. The collection rows stay because they carry the switches,
  Instagram and the uploader; folding them is a separate ruling.

## Generated files (NOT edited — controller regenerates)
- `apps/web/lib/ugat/screens.generated.json` / `scripts/port-control-baseline.json` if the screen/port maps flag the new
  components (`portfolio-groups.tsx`, `body-panel.tsx`, `shop-forms-body.tsx`) — run the repo's regenerators on integrate.

## Shots (`build-notes/shots/b2b/`)
Side by side with v118 (left) at 375 px:
- #31 `sbs-31-shop-light.png` · `sbs-31-shop-dark.png` · `sbs-31-shop-gear.png` (⚙ opens with Your page first; the ★ line
  "4.8 · 38 reviews" is the underlined link → `/vendor-dashboard/website#reviews`, measured)
- #32 `sbs-32-badges-light.png` · `sbs-32-badges-dark.png` · draw-in frame `app-shop-badges-mid.png`
- #33 `sbs-33-makers-light.png` · `sbs-33-makers-mid.png` · `sbs-33-makers-open-light.png` · `sbs-33-makers-open-dark.png`
  · Forms body `app-shop-makers-forms.png`
- #35 `sbs-35-portfolio-light.png` · `sbs-35-portfolio-dark.png` · `sbs-35-stories-light.png` · `sbs-35-video-light.png`
  · `sbs-35-video-edit.png` · unread `app-portfolio-unread.png`
- #40 `sbs-40-album-mid.png` · `sbs-40-album-open-light.png` · `sbs-40-album-open-dark.png`
- Reduced motion: `reduced-33-makers.png` (first frame → settled, a fade) · `reduced-32-40.png` (rings static · album)
Every page `scrollWidth === 375`. The lab has no `header.fd-topbar`, so in the lab the panel starts at the top edge; on
the real page it starts under the bar (the box is measured, `lib/body-panel.ts`).
Known differences from v118, on purpose: no Tools Maker tile (§9 #8); Forms tile says "Sent as a chat card", not "5 saved"
(no read on load); video link rows have no Title (no stored title — NEEDS).

## Where I stopped
All six rows built, guarded, typechecked (repo script, 10 GB heap — a 6 GB run ran out of memory), linted (`next lint` on
every changed file + no-card / field-template / contrast / radius / port-controls / server-only / botnav / masthead /
legibility / dup-rule / vendor-layout), shot side by side with v118, committed and pushed on `claude/supplier-build2-b`
(merged `origin/claude/supplier-1build` at 97cf54af86, clean). No PR opened. Nothing open in this lane except the NEEDS
above.
