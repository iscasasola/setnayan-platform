## 2026-08-29 · fix(papic): the big number says "credits", and the money says "you pay"

Owner, looking at the live dial showing 50,050: *"looking at 50,050 makes it
feel like it is 50,050 pesos and not credits."* He was right, and the cause was
layout, not wording — a large lone numeral on a section headed **What it costs**
reads as a price, whatever the small print underneath says.

Two rules now hold, and both are load-bearing:
1. the count never appears without the word **credits** on the same baseline, and
2. the peso sign appears **exactly once** on the card — on a new *You pay* row —
   so the only thing shaped like money is the money.

Also his: **"Explain credits."** The three bare rows assumed the reader already
knew. It now says what a credit buys, what it does *not* have to buy (the half
people get wrong — they assume the cameras and the wall are metered too), and
that credits never expire and are not a subscription.

**"Snippets term for 10 second video"** — a ten-second video is a **Snippet**,
introduced on first use as *"a Snippet — our ten-second video"* so the page
teaches the word rather than assuming it. Checked first: `snippet` appears in
this codebase only as a YouTube API field and in prose, so the word was free.

**The live wall's own address**, which the page had undersold to one line.
Owner: *"it has an address where you can place to a monitor so it will show the
live photo wall there via browser."* Verified against the shipped route —
`/wall/[eventId]` is a full-screen, no-chrome projection a venue screen reaches
by opening the address and typing a six-character code, and `LIVE_WALL` is in
`FREE_FOR_ALL_SKUS`, so "included" is true for every celebration.

Measured rather than guessed: at the widest rung the number, unit and two 48px
buttons needed ~298px inside a 303px card, so the row was visibly cramped.
Buttons are 44px on phones (still above the 44px touch minimum), type steps down
one size, gaps tighten — measured after the fix at 44px buttons with 8px gaps.

⚠ **Named, not fixed:** "Snippet" is new customer-facing vocabulary and the
product itself still says *clip* / *video* everywhere else. Threading it through
the app is a separate change and an owner call — the page defines the word on
first use so it is self-explanatory in the meantime.

11,346 unit tests green (exit 0) · every blocking lint green, including the
radius guard that is advisory locally and blocking in CI.

SPEC IMPACT: "Snippet" is new vocabulary for the ten-second clip. Recorded for
the corpus, which still calls it a clip.
