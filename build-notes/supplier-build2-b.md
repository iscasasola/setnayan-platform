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
(see "Shots" — measured in the lab; the real page's added reads are listed here)
- **Shop tab:** no new read on load. The Forms Maker's reads (`readShopForms` + tier + `readFormSuggestions`) run only
  while `?maker=forms`. Removed: the inspiration-library access read (moved to Portfolio).
- **Portfolio tab:** one `Promise.all` wave. Added reads: pool bookings (1, shared by event-album titles and stories) →
  featured stories (1, chained), approved looks (1, admin; skipped when the library refuses the shop), Papic capture
  flag (1), album signing (≤ 24 presigns per event, local HMAC — no network round-trip to R2), card album display URLs
  (local). The album rows select widened (same single query). Group albums open with NO new read (already loaded).

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

## Shots
`build-notes/shots/b2b/` — see "Where I stopped".

## Where I stopped
(updated at the end of the session)
