## 2026-08-13 · fix(home): the Alaala tile told the owner his memories had not arrived, with fourteen of them on the same page

Found because the owner sent a screenshot of his home screen and asked a question about something else entirely.

The dark **Alaala** tile on the home board read *"Your moments gather here as events finish."* Measured against his live account at that moment:

- **14 photos and clips** kept in Alaala (Movie Night)
- **0 finished events** — two weddings in December, and Movie Night carries **no `event_date` at all**, so it can never count as finished

So the tile announced that nothing had arrived yet, while the memory wall **further down the same page** was holding fourteen frames. That is what prompted the question.

🔑 **A CLAIM ABOUT MEMORIES MADE FROM A COUNT OF EVENTS** — the identical shape as *"No events attended yet"* printed from an absence of PHOTOS, fixed earlier the same day. It survived that sweep because it lives in a **summary tile**, not in Alaala itself. Alaala keeps photographs; whether a party has ended says nothing about whether anything is kept.

**The fix:** the subtitle is now a description of the destination — *"Every photo and clip you keep"* — true on day one and true at year six, and it never conditions on an event count.

**What was deliberately left alone:** the tile's VALUE stays `finishedCount` / *"celebrated"*. That is an honest count of celebrations, labelled as one, and hidden entirely at zero — so the owner sees no number today rather than a hollow "0". The original author's reasoning for quoting no media total here also still holds and is preserved in the comment: moment totals live behind `AlaalaTile`'s own fetch, and a second copy on the board would be a drifting source of the same number.

**Guards — 3 sabotages, all measured, all caught:** the subtitle must not be chosen by `finishedCount`; the *"as events finish"* promise must not return; the tile must keep a real subtitle and still point at Alaala. A source scan, because `home-board.tsx` imports `next/link` and the unit runner cannot import it — and the extractor asserts its anchor first, so it cannot pass vacuously the day the board's shape changes.

Full suite: **7,834 unit tests green**, typecheck clean, all 21 `lint-*.mjs` guards green.

SPEC IMPACT: None — copy only. No SKU, price, schema or migration.
