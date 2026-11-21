## 2026-11-21 · feat(chat): every ＋ tool needs a verified shop — a server check on every send (UNICHAT ＋ P1)

Owner, v2 ＋ drawing (21 Nov), "Gates": every ＋ tool needs the shop at least Verified, with a server check on every
send. No ＋ send path checked verification before this.

- `lib/shop-plus-gate.ts` (words) + `lib/shop-plus-gate.server.ts` (`shopPlusGate` / `threadPlusGate`, on the ONE
  verification test `fetchShopVerified`). Three verdicts: open · unverified · unknown — a refused read REFUSES
  ("couldn't check"), never lets a tool through. A group thread (no shop) is open.
- Asked BEFORE the write, shop side only: the chat quote (`sendCustomProposalFromChat`, notices
  `proposal_plus_unverified` / `_unknown`) · a form sent to the chat (`formsAction` op=send) · Ask for access · the
  chat's payment ask (`inline=1` only — the client page's own ask is not the ＋) · a schedule request from the shop
  side (a couple's is never gated) · a FILE from the shop in chat (new code `plus_unverified`; plain words always send).
- Guard: `lib/a-plus-tool-needs-a-verified-shop.test.ts` — the gate on a fake client, plus a source guard that each
  send asks the gate before its write (sabotage-checked: removing the forms gate turns it red).
- No server action added (the gate rides existing actions). No migration in this commit — the DB-side triggers for the
  browser/RPC writers (polls, decisions, change asks, offer drops) wait for a migration GO.

SPEC IMPACT: None (implements the approved v2 ＋ drawing's gate).
