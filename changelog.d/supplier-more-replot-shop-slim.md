## 2026-10-21 · feat(supplier): finish re-plot B — More is Event Hub · Settings; How it is going is a Shop segment; one More tools door; Shop › Services loses the tiles and the rail

Owner, verbatim, 21 Oct: *"Yes to all"* — items 1–4 of the supplier-dashboard audit
(`shots-2026-10-21/supplier-dash-audit/AUDIT.md`). Part 1 of 2 (part 2: the bar becomes
Today · Customers · Shop · Hub).

- **1 · Messages and How is my business doing leave More** (`lib/vendor-more-rows.ts`). More is
  **Event Hub · Settings**, as DECISION_LOG 2026-10-08 answer 1 (B) drew it. The envelope already
  landed on the identical Messages URL; How is my business doing is Shop › How it is going and Today's row.
- **2 · Shop › How it is going is a real Shop section.** `/performance` draws `<ShopSegments on="insights">`
  (the tier upsell too) and lights **Shop** on the phone bar and the rail, not More. One list,
  `VENDOR_SHOP_EXTRA_MATCH`, feeds both — and it fixed a second miss on the way: the **rail lit nothing**
  on Shop › Page (Your page · details · collections), which the phone lit since 14 Oct.
- **3 · One door for More tools** — Settings › More tools. The Shop fold and the More row are gone;
  `?open=tools` on Shop redirects to `settings#more-tools`. Not one tool lost (Settings reads the same
  `shop-tool-shelves.ts`).
- **4 · Shop › Services drops the six number tiles and the "On this page" box** (approved S-PR6 shape),
  and the six reads that fed only the tiles (reviews · saves · views · pool bookings · stories + recaps ·
  partnerships). `shop-rail.tsx` → `shop-door-section.tsx` (only the door shell was left).
- Guards: `how-it-is-going-is-a-shop-segment.test.ts` (every Shop segment lights Shop on the bar AND the rail,
  asked through each one's own matcher — `bottomNavItemMatches` (exported from `bottom-nav.tsx`, not a new module:
  the Maker's first load is at its ceiling) and `vendorRailCandidates` were lifted out pure for it; every segment page draws its switcher); `my-shop-reads-at-once` holds the tile reads off
  Shop; `my-shop-doors-keep-every-control` holds the rail and tiles retired and every anchor they
  pointed at. Six sabotage runs, each red.
- Baselines regenerated: port-control, ugat screens.

SPEC IMPACT: DECISION_LOG row 2026-10-21 "SUPPLIER BAR — TODAY · CUSTOMERS · SHOP · HUB" (owner "Yes to all").
