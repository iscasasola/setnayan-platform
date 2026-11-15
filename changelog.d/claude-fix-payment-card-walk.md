## 2026-11-14 · fix(admin): the Work payment card says what is true (walk RW-301)

Six findings from the controller's walk of the live request cards (#7697), payment card:

1. An empty payment method read **"Sent by: Payment"** — now **"Method not given"** (an unknown method is "Another way").
2. **"Receipt not read yet — open it to look at the picture"** sat over **"No reference or screenshot yet"** — the receipt
   line now shows only when a picture was sent.
3. The avatar drew **"TC"** for `testnayan4@…` (T of the name, C of ".com") — initials now follow the person page's rule
   (display name first, else the first two letters of the name or email: "TE"); the title uses the display name.
4. **Open record** opened the whole payments desk — it opens that order's own record (`ugatRecordHref` kind `order`).
5. An order already **paid** (e.g. SNC5597C95) still offered Confirm — the card says "Already paid", offers nothing,
   and points to the record to settle the payment row. The row stays counted (the badge counts what the desk settles).
6. The first tap on a Work row seemed ignored — opening a row is a server read with nothing on screen until it lands;
   the row now says **"Opening…"** while it loads (Next's `useLinkStatus`). Diagnosis: latency, not a swallowed tap —
   no focus or hydration handler sits on the row.

Display-only fields added to the payments read (`orderPublicId`, `orderStatus`, `payerName`, `hasScreenshot`); none
feeds the green rule or any approval.

SPEC IMPACT: None.
