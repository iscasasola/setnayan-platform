## 2026-08-21 · feat(payments): ONE payment page — every purchase lands on the same screen, with a QR that already carries the amount

**Owner, 2026-08-21:** *"there needs to be a payment qr for that purchase where they also
need to place a screenshot of their payment, and the last 6 digits of the reference code…
in short we want a payment page that applies to all, with the custom QR designated to the
amount they want to pay."* Then: *"each purchase they make will jump to a payment page
describing the purchase they want."*

Approved prototype: `prototypes/one_payment_page_2026-08-21.html` (spec corpus).

### What a person gets

`/pay/<reference>` — one page, ONE column, three steps top to bottom:

1. **You're paying for** — the item, the amount, and the reference to put in the transfer note.
2. **Pay this exact amount** — a QR that already carries the figure, so nothing is typed. GCash
   is the default rail because a GCash payer sends for free; BDO is one tap away.
3. **After you pay** — the screenshot **stays on screen above the field** and enlarges on tap, so
   the reference number can be read off it while typing. We ask for the **last 6 digits** only.

### The defect this fixes

A shop buying a plan had **nowhere to send proof at all** — no upload, no reference field, and a
static QR with no amount. That was not only a missing screen: `payments.order_id` is NOT NULL, so
a plan purchase had **no row a screenshot could attach to**. Every other vendor purchase (extra
seat, branch, deep search, booking fee) already mints an `orders` row; the subscription was the
one that did not. It does now, mirroring the RPC's own amount and reference.

🔑 **RULE 0 paid: the exact-amount QR was already built** (`lib/emv-qr.ts`, live-tested on real
wallets 2026-07-31) and both production payloads are decodable. It was wired into the couple's
inline checkout drawer **and nowhere else**, so every other purchase screen showed the plain shop
QR. Nothing was redrawn — the minter is reused.

🪤 **A SECOND COLUMN IS A SECOND SCREEN.** The prototype's first cut put the QR beside the
summary. On a phone it fell off the bottom with nothing pointing at it, and the owner reported:
*"it just went to the you're paying for… never showed the pay this exact amount and no way to get
there."* A guard now fails on any multi-column grid on this page, and a bar pinned to the bottom
always names the next step.

🔒 **One approval, one outcome.** The plan order gives the admin two rows describing one payment.
Approving the payment at `/admin/payments` now **switches the plan on** via a new prefix hook
(`vendor_subscription__<purchase_id>` → `approve_vendor_subscription`, idempotent, gated by
`assertOrderOwnsVendorTarget`). Without it the admin could take the money and leave the plan off.

🔒 The amount logged is the **order's**, never the form's. The payable is resolved on the SESSION
client so RLS decides — a reference that is not yours reads as *not found*, the same answer as a
reference that does not exist, so the page can't be used to test whether a code is real.

### Also

- `pay` is now a reserved word in **both** halves — the generated route list and
  `public.business_slug_is_reserved` (migration `20271154435745`). A shop address is immutable, so
  a business named "Pay" would have held `setnayan.com/pay` forever. Verified in prod first: no
  shop and no event holds it.

### Tests

- `app/pay/one-payment-page.test.ts` — 6 assertions, **every one mutation-checked by occurrence
  count** (two-column grid 0→1 · next-step label 1→0 · preview block 1→0 · private bucket
  thread-files→media · order-amount 1→0 · panel unmounted 1→0), all six RED.
- `lib/vendor-subscription-service-key.test.ts` — the key round-trips, and a non-uuid suffix
  MISSES the hook rather than reaching the RPC with rubbish.
- Rosters updated rather than weakened: the order-minter roster, the activation ownership-gate
  count (4→5), the reserved-slug list, and the public-price literals (₱10–₱15 is the payer's own
  bank fee, not a Setnayan charge).
- 9,185 unit tests green; the slug-mint, UGAT and RPC-argument db suites green.

### Not in this change

- The couple's existing order page still asks for the **full** reference number and has its own
  layout. Pointing the remaining buy buttons at `/pay/<reference>` is the follow-on; nothing was
  taken away from them here.

SPEC IMPACT: `DECISION_LOG.md` — 2026-08-21 row for the ONE payment page (shape, the last-6 rule,
and the reserved word).
