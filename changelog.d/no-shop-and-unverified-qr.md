## 2026-11-02 · fix(supplier): a shop-less account lands on shop set-up; an unverified shop's Locked QR says what to do

Supplier gate audit G7 + G8 (owner 2026-11-02, "THE MINIMUM TO LET SUPPLIERS IN").

- **G7** — `app/vendor-dashboard/layout.tsx`: a signed-in account with no shop and no seat was bounced to `/dashboard` (the couple board). It now goes to `/open-shop`, which sends a named shop's owner back to the dashboard, so the pair cannot loop. A refused read still never lands here.
- **G8** — `issueLockedQr` refused nothing, so an unverified shop's code failed only at the couple's scan with "Something went wrong". Now the QR page shows "A Locked QR books the couple who scans it, and Setnayan books only verified shops…" with a link to Your documents in place of the deal form, the action refuses with `not_verified` before writing a token, and the couple's claim names `vendor_not_verified` instead of the generic error.
- Guards: `lib/an-unverified-shops-qr-says-what-to-do.test.ts`; `lib/no-redirect-cycle.test.ts` and `app/open-shop/has-a-doorway.test.ts` re-pointed at `/open-shop` (the loop property kept).

SPEC IMPACT: None.
