## 2026-11-23 · feat(shop): My QRs, the supplier's one QR page, replaces Promote's QR part

The owner asked for it on 23 Nov: *"this also means we have to get cloud create a QR Page that will replace our current QR page."* It follows DECISION_LOG "STORE DRAWING v13→v18 RULINGS" (1) and the drawing `supplier_store_graphs_badges_2026-11-23`, frames "My QRs" and "One QR, opened" (v18). No new QR types and no schema.

- **`/vendor-dashboard/shop/qrs` (My QRs).**
  - "Your shop" lists Your page · Reviews · Shortlist · Check a date, in the drawing's order (`MY_QRS_SHOP_ORDER`). Each opens its own page.
  - A "QR designs" row goes to Shop › Promote's Prints, because the Toolkit's QR designs shelf is not on main yet. It is never a dead link.
  - There is no "From your widgets" group, because Save to My QRs is not built.
  - A refused read says "Couldn't load your QR codes" with Try again.
- **`/vendor-dashboard/shop/qrs/<code>` (One QR, opened).** It uses the shipped `QrCard`: the big code, Download (filled), Share, Copy link and Write to NFC. Under it is "Print it" › Door print · Prints. Everything the old sheet had stays:
  - Shortlist's two picks (For · Service), carried in the address;
  - the own-link gift on Your page;
  - the "add a gift to your link" notice;
  - the NFC Tap test on Your page.

  The reads moved with the code (`my-qrs-data.ts`), using the same builders as before (`printQrUrl`, `checkADateQr`, `buildVendorInviteUrl`).
- **Every old way in opens My QRs.**
  - The cover's QR sheet (`PromoteBody part="qr"`) is the My QRs list, titled "My QRs". The Promote page draws the same list first.
  - `/shop/promote?mode=…`, Customers › QR codes' forward, Today's "Open QR" and `supplierQrHref` all land on the code's page (`myQrHref`).
  - Promote's ▾ hint reads "My QRs · prints · gifts · share your work".
- **Print it.** The link `?print=<code>[&piece=door]#prints` opens Promote's Prints on that code (`ShopPrintsSection initialAsk`). It replaces the same-page `PromoteBridge` hand-off, which is removed along with `QrCodeList`'s "Put it on…" and `QrCodes`' Promote branch. `QrCodes` is now only Customers › QR codes (Booked · Crew).
- **Lab:** `/dev/supplier-lab?s=my-qrs` and `?s=my-qr&code=page|reviews|shortlist|dates` (`&state=fail|no-address`, `&shell=1`).
- **Guards:**
  - New: `shop/qrs/my-qrs-keeps-every-code.test.ts` (every shipped code, every kept feature, real doors, the old ways in, honest reads). Sabotaged once (the NFC test removed) and it went red.
  - Retargeted to the new home, not weakened: `supplier-qr-codes`, `promote-is-the-prototype`, `the-qr-sheet-says-scan-or-tap`, `every-shop-code-can-be-a-tap`, `every-qr-carries-the-strip`, `check-a-date-qr`, `own-clients`, `supplier-prints`, `the-shop-page-is-setnayan-sourced`.
- Server actions: no new export. Saving the own-link gift (`saveOwnClient`) also revalidates the code page.

SPEC IMPACT: None. It builds the ruled and drawn My QRs page. One open point is reported to the controller: Promote's two-tab sheet is in open PR #8193, and its second tab's label must read "My QRs". The new guard enforces that once the tabs ship.
