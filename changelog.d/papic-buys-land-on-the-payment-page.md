## 2026-09-20 · fix(papic): every Papic buy lands on the payment page

Owner, looking at `/pay/<reference>`: *"papic order is not fixed like the other
purchases… why isn't it like this when they set the price they pay for papic."*

All four Papic buys in the couple's studio — cameras, Limited, extras and the
pool top-up — redirected BACK to the studio with an "Order received — ₱X due"
banner, and charged two more taps ("See how to pay" → the order page → "Pay
now") for the screen every other buy button in the product reaches on the
redirect: the QR with the figure already inside it, the account name and number,
the exact amount to copy, the field for the bank reference.

- `app/dashboard/[eventId]/studio/papic/actions.ts` — all four mints now
  `redirect(payPath(referenceCode))`. The free Unlock-all provisions still
  return before it, so a ₱0 grant is never shown a bill.
- `app/dashboard/[eventId]/studio/papic/page.tsx` — the banner and its four
  params are DELETED, not left unreachable. A confirmation nothing can trigger
  reads as a live screen with a broken trigger.
- `lib/every-buy-button-lands-on-the-payment-page.test.ts` — the derivation
  asked "does this file call `orderRowFor(`", so the Papic mints (which insert
  the `orders` row themselves) were invisible to it and it passed. It now asks
  about the ROW: anything writing a `requested_total_php` into `orders` is a
  paid mint. The admin custom-plans mint is excused in writing — the admin is
  not the payer.
- `lib/the-banner-does-not-promise-an-email.test.ts` — from "the banner links
  somewhere payable" to "each of the four buys ends at `payPath`", anchored per
  function so re-pointing one cannot hide behind the other three.
- `…/studio/papic/_lib/outcomes-are-shown.test.ts` — floor 21 → 17 (four keys
  deleted, not missed) and the newline-blindness canary, whose three sample keys
  went with the banner, now runs the extraction against a wrapped fixture.

SPEC IMPACT: None — no priced SKU, entitlement or decision changes. The server
still resolves every amount from `platform_retail_catalog_v2` (SEC-4/SEC-7); only
where the buyer is sent afterwards changed.
