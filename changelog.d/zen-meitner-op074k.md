## 2026-11-23 · feat(for-suppliers): the owner-approved redesign, built 1:1 on the shipped page

The owner approved the /for-suppliers redesign on 23 Nov ("if this is the best you can do, setnayan for suppliers approve"). Drawing: specs `prototypes/for_suppliers_redesign_2026-11-23/index.html` v4.3.1 and its `art/`. It is built on the shipped route and components (`app/(shell)/for-suppliers/page.tsx`, `app/for-suppliers/_components/supplier-front-*`). No second page.

- **Parts, in the drawing's order:**
  - hero
  - #cards: three beats, each a 4:3 pick clip beside a 3:4 card clip, then the badges row
  - #shop
  - #fees: timed steps with dots and Play again, the two fee rows, the cap line, the first-supplier rule
  - #verified: Today and Verified rows, then the "Try it. No risk." band
  - #tools: two stills, the Toolkit count line and its "See all" `Sheet`
  - #gift
  - #plans: the rail and plan cards, Verified picked
  - the close
  - the following "Open your shop": a floating pill on a phone, a pill under the shell's top bar on desktop
- **Every number is read:**
  - The fee steps and rows: `feeSteps` and `feeRowWords` run on the live schedule (`bookingFeePhp`, `bookingFeeFigures`, `bookingFeeCapAmount`).
  - The gifts: the shop-gift packs on sale (`fetchShopGiftPacks`, `platform_retail_catalog_v2`), the plans' included credits (`planCreditsFrom`) and the 10+1 bundle (`bundleFreePacks`).
  - The Toolkit count: `SPECIALIZED_TOOLS` + `CARD_ORDER` + `SHOP_BADGE_KEYS`.
  - The plans: `planStair` (`TIER_CAPS`) and the catalogue prices.
  - The badges: `SHOP_BADGE_KEYS`, `BADGE_NAME` and the v84 art.
  - A failed read says "Couldn't read", never ₱0.
- **Reads:** the route makes one `Promise.all`. The gift bundles are chained inside it.
- **Part I:** static cards have hairlines and no shadow (the fee card too). Cards use `--m-r-*` radius. The only gradient is the hero's band. No pastel icon tiles. Figures use tabular numbers.
- **Media:** every slot sits in one table, `FRONT_MEDIA`, so the real-capture follow-up swaps files there only. The art is in `public/marketing/2026-11-23/for-suppliers/`; stills were converted to webp. Clips fetch nothing until near the screen, paint their poster first, and play only while on screen.
- **Retired with the 20 Nov page and its 23 Nov redraw:**
  - the live cards, the fee ruler, the "How Setnayan earns" block, the page ⓘ and the plan stairs
  - their guard tests: `the-redraw-plays-what-ships`, `the-fee-bar-really-drags`, `the-fee-ruler-shows-the-lock`, `the-earn-block-says-what-was-ruled`
- **New guard:** `app/for-suppliers/the-redesign-builds-the-drawing.test.ts`. One sabotage seen red: a shadow on a plan card.
- **New word:** `FEE_FIRST_SUPPLIER_LINE` in `lib/booking-fee-who-words.ts`, the drawing's rule line.
- **Server actions:** no new export. No migration. No email.

SPEC IMPACT: None. It builds the APPROVED drawing (DECISION_LOG 2026-11-23 "/for-suppliers redesign APPROVED"). The drawing differences are listed in the PR body.
