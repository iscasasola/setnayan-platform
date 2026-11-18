## 2026-11-18 · fix(prints): every print wears only the approved v84 badges; the retired pills are gone from paper

Stacked on #7925, which changed only the Verified mark on prints. DECISION_LOG 15 Nov: "THE BADGES IN THE APPROVED PROTOTYPE ARE THE ONLY BADGES" (`prototypes/supplier_badges_2026-11-15/badge-milestones_v84.html`).

- **One rule for what a print wears** (`lib/print-badges-v84.ts`, `printBadgesV84`). It replaces `badgesForPrint`, which has been deleted. Each retired pill now prints as its v84 equivalent, or not at all:
  - **Verified** → the v84 blue check. Verified Partner takes its place for life (`displayedSeals`).
  - **N events** → Completed bookings, at its tier.
  - **★ rating** → Five-star reviews, at its tier. The ★ average stays as a plain text line.
  - **Years in business** → removed. "In business since" stays as a text line.
  - **Monthly awards** → removed. The yearly seals print instead.

  A tier is the Shop › Badges shelf's own tile (`shelfBadge`), and only an earned tile prints.
- **The art is the approved art.** Tiers use `public/badges/v84/*.webp`, embedded as PNG with identical pixels; a test holds this. The four seals (Top 10, Clients' Choice, Most In-Demand, Verified Partner) are baked from the v84 `SEALS` by `apps/web/scripts/gen-print-seal-art.mjs`:
  - still: no animation, no screen-only light;
  - every letter outlined in Cinzel Bold;
  - the award's own year on the ribbon.

  No. 1 comes through the award kit's `loadNo1Seal`. The seal art (~270 KB) is server-only; a guard keeps it out of client files.
- **Every print surface now uses it:**
  - the seven prints and their Save files (`/api/vendor/prints`);
  - the badges file (`/api/vendor/badges`);
  - the door sticker, SVG and PDF (`/api/vendor/door-sticker`);
  - the Prints sheet's "Your badges" row, which shows the art each badge prints (`?view=print`).

  The reads are `readPrintBadges` (`lib/print-badges-v84.server.ts`). The art is `resolvePrintBadgeArt` (`lib/print-badge-art.ts`). `next.config.ts` traces `public/badges/v84/*.webp` into the three routes.
- **Guard:** `lib/prints-wear-only-v84-badges.test.ts`. No print surface may import `ShopBadgePill`, `ImageBadge`, `badgeImageOf`, the retired `lib/shop-badges` list or the pill's `TIERS`. This covers the named surfaces plus every shipped file that imports a print renderer.

SPEC IMPACT: None. This applies the 15 Nov ruling to paper and adds no new decision. The No. 1 kit comment says "nothing outside the kit may offer it until he rules". The print shows No. 1 only when `shop_seals` holds a No. 1 row, which only the seal engine writes (ruling 6373). This is flagged in the PR.
