## 2026-11-05 · feat(shop): Shop › Promote — the shop's marketing QR codes move out of Customers (part 1)

Owner ruling 5 Nov: the supplier's QR codes do not belong under Customers; they belong in Shop, beside the website,
print materials and gifts — one "Promote" place for every marketing tool ("So the location of our for page is
correct").

- **New Shop section `Promote`** (`/vendor-dashboard/shop/promote`), after Page in the Shop ▾ (`shop-sections.ts`).
  It draws the shipped `QrCodes` view (`place="promote"`) with **Shortlist · free**, **Check a date · free** and
  **My page** — same component, same words, same behaviour.
- **Customers › QR codes** (`/vendor-dashboard/invite`) keeps **Booked · one-use** and **Crew for an event**. A link
  to a moved code (and a bare `/invite`, which always meant the Shortlist code) forwards to Shop › Promote with its
  picks — no "Edit in X ↗" link.
- The split is ONE list in `lib/supplier-qr-codes.ts` (`PROMOTE_QR_MODES` · `CUSTOMERS_QR_MODES` · `supplierQrHref`),
  guarded to partition `SUPPLIER_QR_MODES` exactly.
- Links updated: For Suppliers "Get your invite link", first-steps "Show your QR to the next couple", and the Dates
  "QR codes" row (now opens Booked; its line names what is there).
- Ugat screens regenerated.

Next parts (not in this change): Booked · one-use onto the customer card · gifts stock + Buy into Promote · Prints.

SPEC IMPACT: `DECISION_LOG.md` — new 2026-11-05 row "Shop › Promote holds the shop's marketing QR codes" (Shop's v13
section list gains Promote after Page; the QR dropdown splits into two homes).
