## 2026-09-18 · fix(payments): the supplier buy buttons, and the page they land on, honour the rail switch

Owner 2026-08-01, verbatim: *"i need a button to turn off the gcash once my
gcash hits the limit for that month."* Past a personal GCash wallet's monthly
receiving limit, transfers **fail at the bank rather than queue**. Earlier today
(`a-closed-rail-hands-out-no-account-number.md`) closed the switch's hole on the
couple side and on the booking-fee page. The supplier dashboard still had its own.

**Re-measured, and the handoff's table was wrong in both directions.** It listed
4 supplier surfaces, called `booth-addon-card.tsx` already done, and still listed
`booking-fees/[orderId]`. Measured against `origin/main`: `booking-fees/[orderId]`
**was already fixed** (it gates on `isChannelOpen`), and `booth-addon-card` was
**not**: the "kill switch" it honours is the 3D-plan one, and its Pay-with radios
hard-code both rails exactly like its siblings. The real set:

- **8 pickers** hard-coded both rails: the AI, 3D Booth and Papic Challenge cards,
  Deep Search, the Papic credit pack, the per-event booth, the branch purchase and
  the Custom-plan configurator. All 8 are reachable, with at least one importer each.
- **9 actions** minted an order and a pending `payments` row with no rail check,
  each with its own local `parseChannel`.
- **2 panels printed both account numbers** straight from settings: the branch
  "How to pay" box and the Custom configurator.
- **`/pay/<reference>`** is where every one of those purchases lands. It read the flag
  alone, so a rail with nothing to pay to showed as open. With **both** rails off it
  defaulted to the disabled BDO tab and still printed BDO's QR and account number.

What changed:

- `lib/rail-for-new-order.ts` gives one gate to all 9 actions (10 call sites,
  because branches has purchase and renew). It uses `resolveChannel`: a closed posted rail moves
  to an open one, since the posted value is only the NOT NULL placeholder and the
  rail is really chosen on `/pay` (2026-08-21). With no rail open it refuses and
  mints nothing. Every free grant still returns before the gate.
- `openRailDetails()` in `lib/payment-channels.ts` nulls a closed rail's name and
  number and carries `open`. The two number panels now take it, so the choice and
  the numbers cannot disagree.
- Each picker offers only the open rails. When none are open it shows the shared
  `PaymentsPausedNote` and disables its button.
- `/pay` asks `isChannelOpen`. With every rail closed it shows the paused message
  instead of a QR or a number. The proof form stays, for somebody who paid before
  the switch.
- `PAYMENTS_PAUSED_MESSAGE` is one sentence, now used by couple checkout too.

**The guard counts.** `lib/a-closed-rail-hands-out-no-account-number.test.ts` gains
5 tests. It sweeps `app/vendor-dashboard`: every file that inserts a `payments` row
must call `railForNewOrder`, and every `name="channel"` picker must ask the open
rails, hard-code none and render the paused note. It prints both counts (9 and 8)
and fails below them, so an empty sweep cannot pass. Seven sabotages, each a real
form of the defect, each turned exactly one test red: a re-spelled channel,
a hard-coded radio, numbers copied from settings, `/pay` reading the flag alone,
`/pay`'s all-closed branch removed, the helper ignoring the switch, and a picker
dropping its paused note. The baseline was green again after restore.
`brand-your-booth-at-one-wedding.test.ts` pinned the booth buy-form mount as an
exact string. It still does, re-anchored to the new mount with `openRails`.

⚠ **Latent today.** Measured in prod on 2026-09-18: both rails are ON, with number,
QR and payload set, so nothing renders differently until the owner closes a rail.

SPEC IMPACT: None. This applies the 2026-08-01 kill-switch decision to the surfaces
it had not reached. The rule and its fail-open contract are unchanged.
