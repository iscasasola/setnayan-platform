# Lane C4 — Shop + Portfolio · build notes

Branch `claude/supplier-1build-c4`, cut from `origin/claude/supplier-1build-base` (50ba2da1). Spec: Setnayan-specs
`plans/supplier_one_build_2026-11-08/` — §9 #8 "C4 OVERRIDES" + §10 (v114) followed over A3.

## Early push (spec §9 #17) — ✅ DONE, pushed
- `apps/web/lib/portfolio-count.ts` → `getPortfolioCount(vendorId, client?)` returns
  `{ ok: true, photos, free, label } | { ok: false }`; `label` = "12 of 50 free photos" / "62 photos · 50 free used".
  Pure words in `lib/portfolio-count-label.ts` (`portfolioCountLabel`) for client components. Same cap as the uploader
  (`portfolioPhotoCap` + `readPortfolioAllowance`). **C1:** import from `@/lib/portfolio-count`; print "Couldn't load" on
  `{ ok: false }`.

## Done (built + unit-tested + typechecked)
| Item | Files | Notes |
|---|---|---|
| Harvest #7338 | `lib/vendor-growth-series.ts` (+test), `lib/analytics-growing.ts` (+test, ONLY buckets/strip/rail/aheadLine), `performance/_components/calendar-strip.tsx` + `analytics-growing.css` (trimmed), `lib/vendor-growth-recs.ts` (+test: the two rule fixes) | `growth-motion.tsx` NOT carried (it needs edits to the shared `components/count.tsx`); motion is CSS. `price-rail.tsx`/`ghost-track.tsx` harvested then removed — unmounted (ugat both-ends flags an orphan); the price face uses the shipped `BandRail`. #7338 can be closed by the controller — C4 read it. |
| Shop tab = ONE scroll | `shop/page.tsx` (recomposed), `shop/_components/shop-cover.tsx` | Cover band (Your page's cover pick else first portfolio photo) · logo → viewer · city · name · Verified / "Get verified · N of 2" (→ ⚙ #docs) · ★ · events ("—" when unread) · "<Plan> plan · what it includes ›" (→ ⚙ #plan) · View shop ↗ · Share · Promote · QR · ⚙. Pinned row "Shop · ★ · events · View shop ↗ · ⚙" fades in over the last 48 px (CSS stand-in until L1's `CollapsingTop`). Your page · Your details rows (with "N fields left"). |
| Logo viewer | logo sheet in `shop/page.tsx` | Mounts the SHIPPED close-save logo row (`ProfileChecklistEditor` → `LogoRowControl` → #7353's `PictureFrameControl`, drag + pinch). Remove → initials is the uploader's own Remove. |
| Cover viewer | cover sheet | Big cover + "Pick from Portfolio" (→ Your page `#cover`, the shipped draft + Apply path, spec §4) + "Upload" (→ Portfolio's Add photos). No "Take a photo" (INVENTED). |
| Share | `shop-cover.tsx` ShareSheet, `lib/share-shop-link.ts` | Copy your link · Photo card (`/api/og/v/<slug>`, SaveFileLink) · Send to a couple (navigator.share, else copy). |
| Promote sheet | `shop/promote/_components/promote-body.tsx` (`part="promote"`) | ONE body; the Promote page mounts `part="all"` (unchanged content). Prints · Gifts · Share your work. No Boost (v112). |
| QR sheet + NFC | `promote-body.tsx` (`part="qr"`), `app/_components/nfc-tap-test.tsx` | Shop codes with the shipped NFC writer per code; Tap test (read-only, `readBackMatches`), status = "Checked on this phone · date" in localStorage only — NO table (spec §4). iPhone Safari: instruction line; iPad/desktop: not drawn; gated by `useNfcEnabled`. |
| Analytics 5 cards | `shop/_components/shop-analytics-carousel.tsx`, `lib/shop-analytics.server.ts`, `performance/_components/card-face.tsx` + `compact` prop on capacity/conversion-deals/price-position/roi-attribution/funnel-benchmark cards | What's ahead · deals · price · worth · compare. Performance's own readers and gates (owner/admin; tier only while `VENDOR_TIER_FEATURE_GATE` is on → "Shows on Pro and up"). `advanceMs={0}` + `dots={false}` (spread as `CAROUSEL_STILL` until `-foundation` adds the `dots` prop — see NEEDS). No "first quote in 5h", "Your imported clients", Reply rate · Reply time · Inquiry → booking. |
| Analytics sheet | same file, `lib/shop-analytics-series.ts` (+test) | By month · By quarter · By year (ONE PickMenu), cumulative line + dashed ghost of the same span last period, "+N% vs last …" / "New" / "Same". Lines only for ahead (booked days), deals (quotes accepted), worth (bookings from Setnayan); price + compare are snapshots → no line. "What it tells you" + "To improve it" = shipped `buildGrowthRecs` only. |
| Badges | `lib/shop-badge-row.ts` (+test), `app/_components/image-badge.tsx`, `shop/_components/shop-badge-row.tsx` | ONE row; closest first = furthest along its rung (the prototype's `nextToEarn`), only it says "N to go"; image badges from the corpus art (seal/hex/star/rosette, Bronze → Black Diamond); sheet = Now · % + bar (ladders only) · "Next goal: N — M to go" · reward box from #7298's engine (`row.reward`). Rating no goal. Unread → "Couldn't load" + "—". 1st Pick "Not counted yet". **Booked Loop + First Booked Loop HIDDEN** (C2's counter not in tree). Founding member from `is_founder`. |
| Makers | `shop/_components/shop-makers.tsx` | Scanner → sheet with one shipped `ServiceScannerPick` per service. Forms Maker door: `formsHref={null}` until C3's route exists (no dead door). No Tools Maker. |
| Services | `shop/page.tsx` | Shipped `ShopServiceRows` (scanner dropdown moved to Makers) + the shipped `VendorServicesManager` WHOLE (every switch, discount, plan hold) + Bundles door (flag) + dashed "＋ Add a service". |

| Shop ⚙ "Business permit" | `lib/shop-permit-line.ts` (+test), `shop/_components/shop-settings-body.tsx` + `shop-settings-rows.tsx` | Inside ⚙ › Verification and documents (`#docs`, row `id="permit"`): "Renews <date> · in N days" / "… — send the renewed one" (≤ 60 days, the shipped `badgeDeadline` window) / "Ran out on …" / "No renewal date on file"; unread says so. ⚠ `next_renewal_due_at` is revoked from `authenticated` (migration 20271222518385) — read through the shop's definer view `vendor_profiles_self`, in its own select. **C1 (A2 A9):** link Today's row to `/vendor-dashboard/shop#docs` (the hash opens the ⚙ on that fold); and read the date through `vendor_profiles_self` too, never `vendor_profiles`. |

## Guards updated honestly (tests that read files I moved)
- `app/open-shop/the-gate-walk-fixes.test.ts` (logo frame now on the cover) · `app/vendor-dashboard/upsells-obey-the-switch.test.ts`
  (shop-badge-row.tsx: "upgrade" = badge reward, same reason as your-badges.tsx) · `shop/promote/gifts-live-on-promote.test.ts`,
  `share-your-work-lives-on-promote.test.ts`, `lib/check-a-date-qr.test.ts`, `lib/supplier-prints.test.ts`,
  `lib/supplier-qr-codes.test.ts` (read `promote-body.tsx`, the ONE body) · `shop/the-shop-sections-are-v13.test.ts`
  (Shop tab drops the ▾ row, v113; sub-screens keep theirs) · `lib/my-shop-doors-keep-every-control.test.ts`
  (`<HeroCard` → `<ShopCover`, door 1 → the rows + ⚙ Team/Docs; ruling cited).

## NEEDS FROM OTHER LANES / CONTROLLER
- **L1 (`-foundation`)**: `components/snap-carousel.tsx` `dots` prop + `advanceMs={0}` = no auto-advance. Until it lands,
  Analytics passes them through a spread (`CAROUSEL_STILL`) — with the base carousel, `0` would auto-advance every tick:
  **merge `-foundation` before any screenshot/review of the carousel.** Then C4 swaps the spread for literal props.
- **L1**: `CollapsingTop` (F2) — Shop's cover/pinned row uses a CSS stand-in (fade over the last 48 px); swap on merge.
- **L1** (`lib/menu-settings.ts`): `portfolio` key in `SettingsMenu` (spec §9 #12) — then C4 adds the entry.
- **L1** (`lib/tours.ts`, `lib/page-home.ts`): Shop tour stops should anchor `shop-analytics`, `shop-badges`, `shop-details`
  (data-tour present on the new parts). The old `shop-segments` anchor is no longer on the Shop tab (still on sub-screens).
- **C2**: `shop_booked_loop_count(vendor)` — when it lands, C4 flips `bookedLoopMeasured` (page.tsx) and the loop rows.
- **C2**: the "40%" → `limitPct` request for C4's service files — not received yet.
- **C3**: the Form Maker's route → C4 sets `formsHref` in `shop/page.tsx` (`<ShopMakers formsHref=…>`).
- **website lane / controller**: `website/_components/page-parts.tsx` should import `shareShopLink` from `lib/share-shop-link.ts`
  (one implementation; outside C4's files).
- **Controller (generated, regenerate on the merged tree):** `scripts/port-control-baseline.json` — `/vendor-dashboard/shop`
  deliberately no longer shows `<CompletenessRing>`, `<HeroCard>`, `<ShopDoorSection>`, `<ShopSegments>` (v113: their
  controls are on the cover, the two rows and Shop ⚙) · `lib/ugat/screens.generated.json` (stale — new doors/sheets).
- **Controller (generated)** `scripts/port-control-baseline.json` also: `/vendor-dashboard/collections` deliberately no longer
  shows `<OpenFoldButton>` (Add photos is the thumb row's ＋, same `#gallery-media` fold) and `<ShopSegments>` (Portfolio is
  its own bar tab with its own pinned row + ⚙).
- **L1 (`lib/menu-settings.ts`)**: C4 added the `portfolio` ENTRY (its file, spec §9 #12) and, so it compiles before
  `-foundation`, the one word `| 'portfolio'` on `SettingsMenu` — if foundation adds the same word, keep one.
- **Base reds (not C4's — red on untouched `origin/claude/supplier-1build-base`):** `lib/export-coverage-guardrail.test.ts`
  (T12 vendor_profiles export projection) · `lib/shop-name-hold.test.ts` (claim_ready_the_shop).

## Open questions (recorded, not guessed)
- Inspiration ladder unit word is the engine's "photos" ("Next goal: 25 photos") — the prototype says "approved inspiration photos".
- Shop Services thumb row search + Show & sort (v95) not built yet (filtering lives inside the shipped manager).

## Request counts (Shop tab, first paint)
- auth + profile (2) → ONE batch: own row · latest application · logo presign · coverages + cards + labels · scan settings ·
  badge facts (admin, 2) → rewards (chained) · analytics (role + up to 10 reads, plan-gated) · cover presign (chained on
  own row). Sheets (Promote, QR, ⚙, logo, cover) read only when opened.

## Screenshots (375 px, light) — side by side with v113/v114
- Lab: `/dev/supplier-lab?s=shop-tab` · `?s=portfolio-tab` (`&unread=1` = every read refused) — `app/dev/supplier-lab/shop-tab-lab.tsx`
  dispatched through `coord-lab.tsx` (C4's lab file; L1's lab registry untouched). Fixtures = v113's SetnaProd numbers.
- Side by side: `build-notes/c4-shots/side-by-side-{shop,shop-scroll,shop-card,shop-badge,portfolio,portfolio-scroll}.png`.
- Build shots: `build-notes/c4-shots/build/*.png` (incl. `shop-fail.png` honest unread words, `portfolio-show.png`,
  `shop-share.png`, `shop-scanner.png`). Reference: `build-notes/c4-shots/v113/*.png`. `scrollWidth === 375` on every shot.
- Deliberate differences from v113 (the map's WRONG/INVENTED rows + spec §4): no GB storage meter (storage out —
  "N of 50 free photos"); "Get verified · N of 2" when unverified; service rows are the shipped manager (no invented
  "610 views"); no Tools Maker; Booked Loop hidden; carousel dots + auto-advance show until `-foundation` lands; the
  Portfolio filter stays the shipped "Show which collections" dropdown above the list (v113 has a funnel in the thumb
  row); album rows use the app's names ("Photos and videos on my page", never client-named sets).
- Dark mode: the supplier `DARK_READY` flag stays OFF this build (spec §4), so dark was not shot; the contrast lint
  (`lint-label-on-fill-contrast`) passes for the new parts.

## Where I stopped
- (updated each push)
