## 2026-08-19 · design(marketing): the seven product pages lead with the headline

**SPEC IMPACT:** None — on-page copy. No price, SKU or catalog value moves.

Owner, asked directly whether the header rule extended to the public marketing
pages: **"build it."**

The seven product doorways (`/papic` · `/panood` · `/patiktok` · `/pawebsite` ·
`/pa3d` · `/palogo` · `/setnayan-ai`) opened with a gold mono eyebrow, then the
headline, then a paragraph. Now they open with **the headline**.

- **5 eyebrows** cut — *"In your wedding · live stream"*, *"…· highlight reels"*,
  *"…· 3D reception"*, *"…· animated monogram"*, *"…· editorial website"*. Each
  restated the product the headline was already announcing.
- **7 hero paragraphs** cut. `kicker` and `lede` are removed from
  `DoorwayProps` entirely rather than left as dead optional props.

**The pitch is not lost — it moves one screen down, where it was already.** Every
doorway renders "How it works" (three steps) and a differentiator immediately
under the hero. On `/papic` those steps read *"Your guests become the crew"* ·
*"Every photo finds its people"* · *"Everyone goes home with theirs"*. That is the
sell, and it is still there.

**Checked before cutting, because these are the pages that earn money:**
- **Search is unaffected.** `metadata.description` on every one of the seven comes
  from `studioDescription(<key>)` — a shared catalog helper, independent of the
  on-page paragraph. `keywords`, `openGraph` and the JSON-LD are untouched.
- **`differentiator.lede` is a different field and survives on all seven** —
  verified by count, one per page, after the sweep.
- **No CTA was lost.** `lint-port-no-lost-controls` ✅ 402 routes / 1429 controls.

⚠ **I ARGUED AGAINST THIS AND WAS OVERRULED, WHICH IS THE OWNER'S CALL.** My
position was that a sub-line on a sales page is a value proposition rather than a
page description. Recorded here so a future session does not "restore" it as an
oversight: the paragraphs were removed **deliberately**, on an explicit
instruction, after the concern was raised and heard.

⛔ **NOT touched, deliberately:** `/privacy` · `/terms` · `/cookies` · `/refunds` ·
`/acceptable-use` — their prose IS the document — and `/pricing` · `/help` ·
`/explore` · `/about` · `/alaala` · `/realstories`, which build their own heroes
and were not part of the ask.

Verified: `tsc` clean (`--version` checked first) · full unit suite green ·
lost-controls guard green.
