## 2026-07-01 · feat(vendor-shop): Locked QR UI — generator (toggle) + customer claim page

The UI on top of the verified Locked QR foundation (`vendor_locked_qr_tokens` +
`vendor_claim_locked_qr()`, migration 20270414692373). Completes the My Shop QR
tooling.

**Generator — `/vendor-dashboard/invite` is now a two-mode "QR Code Generator"**

- **Shortlist ↔ Locked toggle** at the top (the shipped Shortlist flow is
  unchanged; refactored into a `ShortlistMode` sub-view).
- **Locked mode** (`?mode=locked`) — a client form (`LockedQrGenerator`): pick
  event-type + service (the vendor's own coverage), total value, downpayment,
  an inline **payment-schedule editor** (percent/fixed × on_lock/before_event,
  reusing the schedule types + `MAX_SCHEDULE_ITEMS`), and a **downpayment-proof
  upload** (direct-to-R2 via `/api/upload`, `media` bucket).
- `issueLockedQr` server action inserts the single-use token under the vendor's
  own RLS session and redirects to `?issued=<token>`, which renders the token's
  QR + copyable single-use link + a "Create another" affordance.

**Customer claim — `/vendor/lock/[token]`**

- Shows the vendor + the deal (category, total, downpayment received, schedule
  with resolved peso amounts), signed-out → couple sign-up round-trip.
- Signed-in → pick or create an event → `claimLockedQr` calls the atomic
  `vendor_claim_locked_qr()` RPC and routes to that event's vendors surface.
- Terminal states handled: already-claimed (own claim links back to the event),
  void, taken.

**Wiring:** the My Shop **Locked QR** tile now points at `?mode=locked` (was a
`/clients` stand-in).

**Files:** new `lib/vendor-locked-qr.ts` (claim-URL + schedule sanitize),
`app/vendor-dashboard/invite/actions.ts` (issuance),
`.../invite/_components/locked-qr-generator.tsx`,
`app/vendor/lock/[token]/{page,actions,loading}.tsx`; edited
`.../invite/page.tsx` (toggle + modes) + `.../shop/page.tsx` (tile href).

Verified: `pnpm typecheck` + `pnpm lint` clean; the claim RPC itself was
DB-verified in the foundation PR (#2522). Admin visibility of issued/claimed
locks is a small follow-up (the token table already grants console-admin read).

SPEC IMPACT: None (implements the prototype's `lockqr` UI). Design:
`03_Strategy/Vendor_Dashboard_Reorg_2026-07-01.html` + `Vendor_MyShop_Actual`.
