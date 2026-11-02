## 2026-09-18 · fix(payments): switching a rail off stops every page handing out its number

Owner 2026-08-01, verbatim: *"i need a button to turn off the gcash once my
gcash hits the limit for that month."* Past a **personal** GCash wallet's
monthly RECEIVING limit, incoming transfers **fail at the bank rather than
queue** — so a page that still shows the number after the switch is off does not
look stale, it takes somebody's money into an account that will bounce it.

The switch reached checkout and stopped there. `hasMerchantPaymentInfo()` asked
*"are any account details filled in?"* and two pages printed the owner's GCash
number and BDO account on the strength of it, each spelling its own per-rail
test as `settings.gcash_number || settings.gcash_qr_url` — which is
`isChannelOpen` with the kill switch dropped out of it.

- `lib/platform-settings.ts` — `hasMerchantPaymentInfo` delegates to
  `openChannels`. Its own docblock already said *"Read through
  lib/payment-channels.ts, never directly."*
- `lib/payment-channels.ts` — `ChannelSettings` gains the QR urls and
  `openChannels` accepts **number OR QR**, because a QR is something you pay
  to. That widening is what let three surfaces delegate at all; without it,
  delegating would have hidden a payable rail. New `isChannelOpen(settings,
  channel)` so a render site never re-spells the rule.
- `app/papic/order/[token]` and `app/vendor-dashboard/booking-fees/[orderId]`
  gate each panel on `isChannelOpen`.

**A sweep guard** walks every file under `app/` and `components/` and fails on
any `X_number || X_qr_url` pairing — the second spelling IS the defect, so that
is what goes red. Sabotage-proven: restoring the original expression, undoing
the delegation, and removing the switch itself each fail (1, 1 and 6 tests).

**Measured, and smaller than the register claimed.** The row said "5 of 7
screens"; nobody had enumerated the seven. Enumerating by the *account details*
rather than by the switch-readers: 99 files mention the rails, 18 touch the
details, 10 are payment surfaces, and only **2 live ones** ignored the switch.
Of the rest — `choose-plan-sheet` and `studio/patiktok` route through
`InlineCheckoutDrawer`, which already gates; `components/billing/ManualCheckoutModal.tsx`
and `/api/v1/billing/initialize-maya` have **no live callers**, which
`changelog.d/payment-channel-kill-switch.md` recorded on 2026-08-01 — *"left
alone rather than editing dead code."* That decision stands; neither was
touched.

⚠ **Latent today** — both rails are ON in production and `papic_guest_orders`
holds 0 rows. It bites the first time the owner closes a rail at its cap.

SPEC IMPACT: None. `openChannels` accepting a QR-only rail widens the
2026-08-01 contract in the fail-open direction it already chose.
