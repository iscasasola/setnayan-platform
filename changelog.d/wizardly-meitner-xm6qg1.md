## 2026-11-22 · fix(quotes): the two older quote doors refuse an unverified shop

Supplier launch walk, 22 Nov 2026 (`SUPPLIER_LAUNCH_WALK_2026-11-22.md`, step 8 · Build 2). Since the 21 Nov ruling (#8119) an unverified shop cannot send a quote from the chat (`sendProposalFromChat` and `sendCustomProposalFromChat` ask `threadPlusGate`). Two older doors skipped that check, so an unverified shop could still send a quote through them. Both now ask the same gate before they write anything:

- **The quotes page's Send** (`app/vendor-dashboard/proposals/actions.ts:sendProposal`) asks `shopPlusGate` about the draft's own shop before the draft→sent flip. It fails closed: if the draft read is refused or finds nothing, the send is refused as "couldn't check" and never goes through on an unchecked shop. The quote page (`app/proposals/[publicId]`) shows the chat door's own words (`PLUS_NEEDS_VERIFIED` / `PLUS_GATE_UNKNOWN`), says the draft was kept, and links to **Get verified** (`PLUS_TRAY_VERIFY_HREF`).
- **The app's quote route** (`app/api/vendor/chat/[threadId]/proposal/route.ts`) asks `threadPlusGate` before `sendProposalCore`. An unverified shop gets `403 { error: 'plus_unverified', message, verifyHref }`. A failed read gets `503 { error: 'plus_unknown', message }`.

No new check was written: both doors reuse `lib/shop-plus-gate(.server).ts`, which reads `fetchShopVerified`, the one verification test. No new server action.

Guard: `lib/a-plus-tool-needs-a-verified-shop.test.ts`. Both doors are added to the "asks the gate before it writes" list, and a new block checks that each door refuses before it writes, that `sendProposal` refuses an unread draft, and that the page shows the words and the Get verified link. Each check was broken on purpose and the test went red: the refusal deleted from `sendProposal`, its `'unknown'` fallback flipped to `'open'`, and the refusal deleted from the route.

SPEC IMPACT: None. This builds step 8 of the supplier launch walk as written; the corpus already states the rule.
