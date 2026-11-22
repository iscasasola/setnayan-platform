## 2026-11-21 · feat(chat): every ＋ tool needs a verified shop — a server check on every send (UNICHAT ＋ P1)

Owner, v2 ＋ drawing (21 Nov), "Gates": every ＋ tool needs the shop at least Verified, with a server check on every
send. No ＋ send path checked verification before this.

- `lib/shop-plus-gate.ts` (words) + `lib/shop-plus-gate.server.ts` (`shopPlusGate` / `threadPlusGate`, on the ONE
  verification test `fetchShopVerified`). Three verdicts: open · unverified · unknown — a refused read REFUSES
  ("couldn't check"), never lets a tool through. A group thread (no shop) is open.
- Asked BEFORE the write, shop side only: the chat quote — custom AND from a saved package (`sendCustomProposalFromChat`
  · `sendProposalFromChat`, notices
  `proposal_plus_unverified` / `_unknown`) · a form sent to the chat (`formsAction` op=send) · Ask for access · the
  chat's payment ask (`inline=1` only — the client page's own ask is not the ＋) · a schedule request from the shop
  side (a couple's is never gated) · a FILE from the shop in chat (new code `plus_unverified`; plain words always send).
- Guard: `lib/a-plus-tool-needs-a-verified-shop.test.ts` — the gate on a fake client, plus a source guard that each
  send asks the gate before its write (sabotage-checked: removing the forms gate turns it red).
- Migration `20271357625672_every_plus_tool_needs_a_verified_shop.sql`: the four ＋ tools that write from the BROWSER
  (a poll · a decision · a plan/change ask · a dropped offer) get ONE `BEFORE INSERT` trigger each
  (`tg_chat_plus_needs_a_verified_shop`). It refuses only the shop's side of a supplier chat while the shop is not
  verified (`PLUS_NEEDS_VERIFIED`, 42501). Server writes, group threads, the hosts and a host of the event pass; a
  plain chat line is never gated. No function body is replaced. Proved in
  `tests/db/every-plus-tool-needs-a-verified-shop.db.test.ts`. The poll, decision, plan and offer cards show the
  gate's words for the refusal.
- No server action added (the gate rides existing actions; still 1251/1251).

SPEC IMPACT: None (implements the approved v2 ＋ drawing's gate).
