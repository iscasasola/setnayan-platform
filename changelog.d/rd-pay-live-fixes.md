## 2026-10-13 · fix(pay,papic): one press, one bill · a sign-up bill lists its lines on /pay

Two live faults found by the 2026-10-13 Papic end-to-end tester (owner: "Yes, fix now").

**1 · "Continue to payment" made one order per press.** The Papic credits card's
button had no pressed state and each press minted a new unpaid order (two
presses, two orders).
- The four Papic buy buttons (credits, extra cameras, guest-list cameras, the
  guest's own offer) lock at the first press and say "Opening payment…" (or
  "Adding your cameras…" / "Adding new guests…") until the page moves.
- Server half, `lib/one-press-one-order.ts`: an open twin — same event, buyer,
  SKU, amount and description, still `submitted`, no payment logged, made in
  the last 10 minutes — is the bill a repeat press lands on (checked before
  minting); and when two presses arrive together, the later order cancels
  itself straight after minting, before any camera, snapshot or guest row is
  written. Fails open on a read error. Extends the existing "one open order per
  (buyer, rung)" rule; no schema change.
- Measured over the replayed schema with the real actions: two presses
  (one after the other, or together) made 2 open orders on every one of the
  four paths before; 1 open order after.

**2 · /pay never listed an onboarding bill's items.** `payable-by-reference.ts`
read `onboarding_order_items` on the payer's own session; that table is shut to
every session role, so every /pay view logged "permission denied" and a sign-up
bill (Papic + AI + Pro) showed a total with no lines.
- New SECURITY DEFINER `public.order_basket_lines(order_id)` (migration
  `20271267903706`): the order's buyer, the couple on its event
  (`current_couple_event_ids`, never any member), an admin, or service_role get
  the lines with their catalog titles in one round trip; everyone else gets
  nothing. The table stays shut.
- /pay asks only for an `ONBOARDING_SERVICES` order, and says "We couldn't load
  the list of what this covers just now…" if the read fails instead of drawing
  an empty bill.
- Requests per /pay view (replayed schema, real page): basket bill 10 → 10;
  every other order 10 → 9.
- Exposure baseline: one accepted line (`order_basket_lines`, exec=authenticated).

Tests: `lib/one-press-one-order.test.ts`, `lib/the-payer-sees-their-own-bill.test.ts`,
`tests/db/the-payer-sees-their-own-bill.db.test.ts` — each sabotaged red, restored green.

SPEC IMPACT: None — restores behaviour the locked flows already promise (apply-then-pay
lands on /pay once; the onboarding bill is itemised).
