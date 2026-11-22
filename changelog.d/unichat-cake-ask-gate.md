## 2026-11-22 · fix(chat): the Cake Maker's "Ask for a cake design" checks the verified shop at the server

Ship review of batch L/N: the Cake Maker invite (`runCakeAction` op `invite`) had no verified-shop check of its own —
batch N only hides the tile. Owner 21 Nov: every ＋ tool needs the shop at least Verified, with a server check on every
send.

- `app/_components/cake-maker/cake-actions.ts`: the invite asks `shopPlusGate` (the #8119 gate) before the invite line
  is written and returns the gate's own words. An unverified shop is refused; a failed verification read is refused
  too. Read with the service client, like the shop's options beside it (an Account Manager cannot read the shop row).
- Guard: `lib/a-plus-tool-needs-a-verified-shop.test.ts` — the invite asks the gate, refuses on its answer, and does so
  before `sendChatMessageCore`. Sabotage-checked three ways (gate removed · refusal removed · gate after the send): each red.
- No server action added, no migration.

SPEC IMPACT: None.
