## 2026-08-13 · fix(front-door): a couple's story shows itself, not the words "THEIR STORY"

**#4400 fixed exactly this defect for the SHOP card and did not sweep the card beside it on the same shelf.** Its guard — *"12 · A LIVE SHOP SHOWS ITSELF, NOT THE WORD 'SHOP'"* — asserts the literal word is absent **inside `ShopCard` only**. `StoryCard`, one function away, serving the same one shelf, went on printing its own name where the picture goes.

🔑 **WHEN YOU FIX A CARD-SHAPED BUG, SWEEP EVERY CARD ON THAT SHELF.** Same lesson as the soft-404 that was fixed on the bare-root vendor route and left standing on its `/v/` twin, and as the address resolver wired into the two obvious routes while the two carrying the *printed* artefacts were missed.

### What a person would have seen

The first couple ever to have their story featured would find, in the place where their photo belongs, the words **THEIR STORY** in small grey letter-spaced type on a beige gradient — the unmistakable look of an image that failed to load. The 9:16 card in the story row was worse: it rendered **nothing at all**, a bare gradient rectangle sitting between article cards that every one of them carries a real cover for.

### The data was already there

`StorytellerTileItem` has carried `thumbUrl` (the poster) and `excerpt` (the opening line, explicitly *"shown as the hero when there is no `thumbUrl`"*) all along. `FrontDoorStory` simply never carried either, so the card had nothing to render and fell back to a word.

**Ported, not invented.** The shipped `StorytellerTile` on `/realstories` already decided this: *"two grammars, decided by what the chapter actually IS"* — the poster when there is one, the opening line as a typographic hero when there is not, because *"a written story is not a video with a missing image, so it never renders an empty grey box."* Both renderings now do the same, with the chapter kind as the terminal fallback for a chapter that legitimately has neither.

### 🪤 A plain `<img>`, and the reason is load-bearing

`youtubeThumbFromEmbedUrl` returns `https://i.ytimg.com/vi/<id>/hqdefault.jpg`. **`i.ytimg.com` is NOT in `remoteImagePatterns`**, so `next/image` would answer **400** and the poster would silently never appear — no error, no log, just an absence. That is precisely how the R2 remotePattern shipped broken app-wide and went unnoticed until the first R2 image was ever requested.

`next/image` is the obvious, house-style choice here and it is the wrong one until the host is allowed, so it is now **guarded in both directions**: reach for the optimizer without adding the host, or add the host and forget one of the two lists, and the test fails.

**Measured, not assumed** — three separate gates, and they disagree:

| gate | allows `i.ytimg.com`? |
|---|---|
| enforced CSP (read off the live response headers) | **no `img-src` directive at all** — images unrestricted |
| report-only CSP (`next.config.ts`) | ✅ already listed |
| `remoteImagePatterns` (the image optimizer) | ❌ **absent** |

So a direct `<img>` works today **and** after the report-only policy is enforced. ⚠ I nearly asserted "ytimg is absent from the config" off a range-scoped grep; `grep -c` over the whole file returned **1** and sent me to the CSP line. **A scoped search that misses a hit is not a negative result.**

### The guards, mutation-tested by occurrence count

- **18** — the literal words are absent from `StoryCard`, both grammars are present in **both** renderings, *and* `data.ts` actually carries the two fields. A card that branches on data nothing supplies renders the fallback forever and looks exactly like a design choice.
- **19** — the poster is not routed through the optimizer unless the host is allowed.

Anchored as a text node (`>\s*THEIR STORY\b`), not `>WORD<` — test 12 records that the `<`-anchored form was slipped by a trailing newline and proved decorative.

**6 sabotages, 6 caught**, each with the probe's occurrence count printed before → after so a mutation that did not land could not be mistaken for a guard that held: the word restored · the excerpt fallback removed · the story row returned to an empty box · the poster switched to `next/image` · and each of the two data fields dropped.

Full suite: **7833 tests, 8 failing — all 8 fail identically at `origin/main`** (`papic-*-metering`, `perceptual-hash`, `vendor-deep-search*`). All 23 lint scripts pass.

⚠ **Nothing renders this card today** — production has 0 featured chapters. This lands before the first one, not after.

SPEC IMPACT: None. No SKU, price, schema or migration. The prototype draws `THEIR STORY` in a `.thumb` box styled as a grey-on-beige placeholder with no image data anywhere in the mockup — a stand-in, exactly as `SHOP` was, and already read that way by #4400. No design decision changed.
