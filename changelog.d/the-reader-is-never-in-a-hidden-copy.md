## 2026-09-09 · fix(story): the page opens in its morning colour again

**SPEC IMPACT:** None.

### What a reader was getting

The story's scroll tracker decides which entry the reader has reached. Since S9 it has driven the
dial's needle and the "now" readout; since S10 it also drives the **colour of the whole page** and
the room panel beside it. It walked every `[data-story-entry]` in the document and kept the last one
whose top was above the read line.

🔴 **A `display:none` subtree reports a top of exactly 0 — and zero is above every read line.** The
hidden copy also sorts LAST in document order, so it always won. The reader was pinned to the final
entry from the moment the page loaded and never released: the needle at the end of the dial, the
readout naming the closing entry, and **the page painting its closing colour instead of its
morning one.**

### Measured, in a real browser, on the live site

`/movie-night`, 2026-09-09: **six** `[data-story-entry]` elements in the DOM — three drawn, three
inside a `<div hidden>` — and `--color-cream` computing to the `after` stage at scroll position
zero, where it should have been the road's.

⚠ **Where the hidden copy came from, honestly:** the server sends ONE story. React's streaming SSR
parks finished content in `<div hidden id="S:0">` and a script relocates it; in the browser used
here the buffer still held a full copy after hydration. **That may be an artefact of the automated
browser rather than something every visitor hits** — it was seen in one browser and is not
reproducible from the served HTML alone.

🔑 **The fix is right either way, and that is the point.** A scroll tracker has no business
following a box that is not being drawn — and hidden copies are ordinary: a print view, a closed
index tab, an un-opened overlay, a streaming buffer. S11 and S12 are about to add two of those to
this very page.

### The fix

`readerReached()` in the pure module now skips any entry with no extent, and the clock calls it
instead of holding the rule inline. Putting it in the pure module is what lets the guard run the
real arithmetic against the exact six-box DOM measured above, rather than asserting about a regex.

`entryIsRendered` tests **extent, not position** — an entry scrolled far off-screen is still drawn
and still followable; only a `0 × 0` box is not.

| Sabotage | Result |
|---|---|
| the tracker follows unrendered entries again (the live bug restored) | 26→**1 fail** |
| `entryIsRendered` made over-broad (a wide zero-height box called hidden) | 26→**1 fail** |
