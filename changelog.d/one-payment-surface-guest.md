## 2026-09-20 · fix(pay): the account-less guest gets the one paying style too

Owner: *"again all payments entering us should be one paying style."* No
exceptions — including the last holdout, the door a guest opens with a bearer
token and no account.

- `app/_components/payment/pay-rails-block.tsx` (new) — the rails as a drop-in
  for a SERVER page. `ChannelToggle` and `PaymentDetailsBlock` need one piece of
  state between them (which rail is selected) and an RSC cannot hold it; without
  this, every server page grows its own client wrapper, which is the duplication
  this change is undoing one level down. A closed rail can never be the one on
  screen, even if it was selected before the owner shut it.
- `app/papic/order/[token]/page.tsx` — renders that block instead of its own
  BDO/GCash tiles, and mints both codes on the SERVER exactly as /pay does. This
  page had only ever shown the STATIC uploaded code, so a guest scanned it, their
  wallet opened at **₱0**, and they typed the figure by hand. It now carries the
  amount.

🔑 **The style moved; the route did not.** /pay's read is session-scoped, so a
guest with no `auth.uid()` cannot open it — redirecting them there would 404 them
on their own order. The page keeps its bearer-token read and its own proof form.

⚠ `amount ?? 0` never reaches a code: `mintedQrImage` is given the real amount or
nothing at all, so a missing figure falls back to the static image and
`qr-amount-truth` says the amount must be typed, rather than minting a ₱0 code.

Guard: a fourth test in `one-payment-surface.test.ts`, sabotage-proven both ways
(drawing the static code directly → red; moving the mint off the server → red).
Its static-fallback check is written as a **per-line scan, not a lookahead** — the
first cut looked forward for `staticUrl` while the real line reads
`staticUrl: settings.gcash_qr_url`, where it sits behind, so it fired on correct
code. A lookahead facing away from what it must see cannot match the line it was
written for.

SPEC IMPACT: None.
