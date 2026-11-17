## 2026-11-16 · fix(vendor-chat): the "couples pay you directly" notice lays out by its pane, not the screen

W1 tablet/desktop walk, RW-351.

In the supplier's chat thread the notice *"Couples pay you directly… Add a payment method · Not now"* stands in the thread pane beside the conversation list. The notice look puts its sentence and its two buttons on one row from a 768px **screen** — so in the narrow pane the sentence went one word per line under overlapping buttons at 768, and was squeezed to ~96px at 1280.

The in-place payout notice now makes its own box a size container and, while that box is under 600px wide, keeps the phone's layout: the sentence, then the two buttons on their own row. In a wide box it is unchanged; on a phone (390) it restates what the phone already draws. The shared notice look is not edited.

Guard: `the-pay-notice-follows-its-pane.test.ts` — sabotaged once (the nudge dropped back to a plain margin → red).

SPEC IMPACT: None.
