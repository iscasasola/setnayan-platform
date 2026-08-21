## 2026-08-21 · fix(papic): a guest can no longer buy shots into a celebration that has finished

**Owner ruling, 2026-08-21.** Asked whether a guest may still buy Papic shots after the event: **"no. it needs to be in a new event."**

Papic credits are scoped to ONE celebration — they are spent by cameras shooting it. Selling more into a finished event takes money for something the buyer can never use.

## Why the couple-side gate did not cover it

The guest purchase mints its own orders and is reachable **with no account at all**. It never touches `submitOrderAction`, so the refusal added there this morning could not see it. It also never consulted the capture window.

The refusal now sits on the mint, on **the credential's own event** — read off a claimed camera token or a signed guest-session cookie, never off a form field. That is deliberate and inherited: this action has never accepted an `event_id` input, because one would let anyone with the public key mint orders against arbitrary events. A gate that took a form value would have re-opened exactly that.

## What is deliberately NOT gated

⚠ **Settling an order that already exists.** A guest who bought before the party ended still owes that money and must be able to pay it. Blocking `submitPapicGuestPayment` would strand a real debt behind a rule about NEW purchases. A test asserts that action never learns about the phase — and the mutation that adds it there turns the suite red.

## The doorway too, and one helper

The buy panel stops rendering on both surfaces that mount it. **That is the doorway, not the rule** — every export of a `'use server'` module is POST-able by action id whether or not any UI references it, so hiding the panel closes the button and not the door. It is there so nobody is offered something they would then be refused.

🔑 **ONE helper, not a second copy.** This morning's Papic gate declared its own four-column read and five-argument call inside the studio actions file. The guest path needed the same answer, so both now call `lib/event-is-over.server.ts`. Two copies of "did this happen" is how a product comes to disagree with itself.

⚠ **It asks the lifecycle resolver, never the Papic capture window** — that window FAILS OPEN when a couple never set bounds, which is most events, so a gate built on it would simply not exist for them.

⚠ **Fail-soft, and the direction is deliberate:** an event row that cannot be read reads as "not over", so a transient database blip never refuses a paying customer.

## Verification

8 sabotages, each measured by occurrence count, each RED — including the two that matter most: **the gate reading a form field instead of the credential**, and **the over-reach that blocks a guest from paying a debt they already owe**.

🛡 **And the guard written this morning caught this very refactor.** It asserted the local helper by name across four call sites; renaming it to the shared one turned the suite red on the run that made the change. Updated to the shared call, and re-verified that it still **localises** — removing the refusal from one of the four actions alone still fails.

- Unit suite **9268 pass / 0 fail**. Typecheck, `next lint` and the lint guards clean, including `lint:server-only`.

⚠ The guest buy path is behind `NEXT_PUBLIC_PAPIC_GUEST_BUY`, whose production value is build-time inlined and not readable from a session. This is correct whether it is on or off.

SPEC IMPACT: None — no price, no SKU, no schema. One owner ruling encoded on an existing purchase path.
