## 2026-08-29 · design(papic): the feature list is folded, and it comes after the price

Owner, 2026-08-29, after reading `/papic` on a phone for the first time: ***"cut it down"*** and ***"yes after the price"***.

**Measured at 375px wide, not eyeballed.** The page ran **12,847px — 15.8 phone screens**. The brief's own § 4 complaint was that the *previous* version, at 5,514px, was already too long, and § 5 asked for **"shorter than today, not longer"**. It had become 2.3× longer than the version that was already judged too long.

**One block caused it.** "Everything it does" was **4,792px — 37% of the page, nearly six phone screens on its own** — and it sat between the three steps and everything a buyer decides on: the comparison, the two ways to run it, and the cost. A reader had to scroll past six screens of specification to reach the price.

**Two changes, both structural, no copy rewritten:**

1. **The twenty short rows are folded** behind *"And everything else · N more"*, matching the `<details>` pattern the FAQ on the same page already uses. The six spotlights with photographs are untouched — they are the story; the twenty are the specification, and **a specification is something you go and open, not something you scroll past to reach the price.**
2. **The whole section moved below the cost block**, above the questions.

⚠ **FOLDED, NOT DELETED, and the distinction is the point.** Every line is a real thing the product does and several are the strongest material we have — the blur, the screening before display, the moderation. `<details>` keeps the content **in the DOM**, so it stays indexed and a reader who wants the list still gets all of it.

🔑 **THE REMOUNT SITS OUTSIDE THE COST BLOCK'S CONDITIONAL, DELIBERATELY.** That block renders only when a price resolves and **fails quiet by design** — a rung it cannot price is dropped rather than shown at ₱0, and if nothing resolves the whole section is omitted. Mounting the features inside it would make **a third of the page vanish on a degraded price read**, with nothing on screen to say why.

**The count is derived** (`EVERYTHING_ELSE.length`), never typed: a hand-written "20 more" is wrong the first time somebody adds a row, and no number on this page is hand-written.

**Guards.** `papic-page-says-only-what-is-true.test.ts` grows two: the list must stay folded with its count derived, and the section must come after the cost block **and outside its conditional**. **4 mutations, printed before → after, all RED** — unfolding the list (1 → 0), typing the count (1 → 0), moving the section back above the price, and mounting it inside the cost conditional.

SPEC IMPACT: `PAPIC_PAGE_BRIEF_FOR_CHAT_2026-08-29.md` § 4 — its measured height table is superseded; the page had grown to 12,847px before this cut. Owner ruled the shape on 2026-08-29.
