## 2026-09-20 · refactor(pay): one payment surface — the drawer's rails, on /pay too

Owner, holding the Papic payment screen next to the couple's checkout drawer:
*"they have a different payment process… cant we have 1 type of payment process?
and just have this one that pops up on the right corner?"*

Two surfaces rendered the same three facts — which rails are open, the QR with
the amount in it, the account to send to — in two layouts with two sets of words.
The drawer said "Save image · scan from gallery"; /pay said "Save code to my
photos". The same button, drifted, and nothing could tell you: each was only ever
compared against itself.

- `app/_components/payment/payment-rails.tsx` (new) — `ChannelToggle`,
  `MethodCard`, `PaymentDetailsBlock`, moved out of the checkout drawer, plus a
  standalone `PayRailSettings` / `RailInfo` vocabulary so neither side has to
  import the other's props type.
- `app/pay/[reference]/_components/pay-panel.tsx` — renders those rails; its own
  `ChannelTab` and `QrTile` are deleted.
- The shared block formats through `payAmount` (`lib/pay-amount.ts`) rather than
  its own `toLocaleString`, so the figure a payer reads is the digits
  `mintOrderQr` writes into EMV tag 54.

⚠ **The look merged; the mechanism did not.** `/pay` mints its QR on the SERVER —
because minting in the browser left the static ₱0 code on screen until the
`qrcode` chunk arrived, which the owner paid through earlier the same day. So
`RailInfo` prefers a rendered `mintedUrl`, and `/pay` passes one and NO payload.
The drawer still draws in the browser and therefore still has that window: a
separate change, listed rather than half-done.

⚠ **The two lifecycles are unchanged and stay that way.** The drawer is
pay-then-mint (no order until the proof is submitted, so an abandoned checkout
leaves nothing in the admin queue); `/pay` is apply-then-pay, which is what makes
it an address you can return to. Apply-then-pay is a locked decision.

Guards: `app/_components/payment/one-payment-surface.test.ts` (both surfaces use
the shared rails, neither keeps a copy; `/pay` passes a server image and no
payload) — both sabotage-proven. `the-figure-and-the-qr-agree` was re-pointed to
follow the rule into its new file rather than losing coverage silently, and
`port-control-baseline.json` regenerated so the moved controls appear as one
readable line.

SPEC IMPACT: None — no price, SKU or lifecycle changed.
