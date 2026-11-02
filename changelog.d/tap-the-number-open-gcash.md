## 2026-09-22 · feat(payments): tap to open GCash beside the number, measured not guessed

Owner, watching Messenger: *"when we click a gcash number, it jumps to gcash.
how can we do that effect?"*

The effect is a deep link, and which one works is a fact about a real phone, so
it was measured on one rather than reasoned about. A probe page with five link
formats was tapped through on the owner's iPhone with GCash installed, from a
plain local page in Safari — no iframe in the way — behind a `tel:` control that
fired first, so a "nothing happened" meant the link and not the harness:

- `gcash://` → **opens the app**
- `gcash://home` → **opens the app**
- `https://www.gcash.com/` → does NOT open the app (no Universal Link)
- `https://m.gcash.com/` → does NOT open the app

Shipped:

- `lib/wallet-handoff.ts` — the measurement, its date and its limits in the
  docblock, plus an **exact-match** `walletSchemeFor`. Exact because the rows
  beside this button are bank rows: a fuzzy match eventually opens GCash for a
  BDO transfer and points real money down a rail nobody is watching.
- `app/_components/open-wallet-button.tsx` — renders only on a coarse pointer
  (a `gcash://` button is dead on a desktop), and admits when nothing happened:
  an unhandled scheme on iOS is silent and looks exactly like a slow app, so if
  the page is still visible ~1.4s after the tap it says the app didn't open and
  offers somewhere to go.
- Wired into the two surfaces that already show a number — `payment-rails.tsx`
  (Setnayan's own rails) and `vendor-direct-pay.tsx` (a supplier's account).
  Both already rendered the number with a copy control; this sits **below** it.
- `lib/the-handoff-cannot-pick-the-wrong-rail.test.ts` — 5 guards, each
  sabotage-checked. The load-bearing one ties `WALLET_SCHEMES` to
  `PAYMENT_PROVIDERS`: the two lists live in different files, so a rename in
  one would leave a button that renders for nobody while both lists still agree
  with themselves.

What this deliberately is NOT: an amount rail. GCash publishes no link format
carrying a payee or a figure, so no probe could have found one and none is
claimed — a guard fails if a scheme ever grows a query parameter. The
amount-baked QR stays the only path that hands a wallet a figure to charge.

⚠ **One phone, one OS, one app version.** `gcash://` is not a published
contract and can vanish in any GCash release; **Android is unverified** (the
`intent://` probe is invisible on iOS and was never tapped). So the handoff can
only ever save a tap — the number and its copy control render beside it, never
behind it, and a guard asserts that. Maya is deliberately absent despite sitting
next to GCash in `PAYMENT_PROVIDERS`: `maya://` was never probed. Measure it,
don't infer it.

SPEC IMPACT: None. No schema, no price, no locked decision — presentation only,
on surfaces that already existed. Off-platform payment posture is unchanged:
Setnayan still never holds or routes the money.
