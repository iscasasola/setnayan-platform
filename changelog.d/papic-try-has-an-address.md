## 2026-08-29 · feat(papic): the demo has an address, the share card has a photograph, the photographer gets an answer

Three fixes, all about what the page does when nobody is looking at it.

### 🚨 The share card had no photograph on it

Every share of `/papic` on Messenger or Facebook rendered `brand/og-card.webp` —
the house card, a typographic *"Set na 'yan."* panel with **no photograph at
all**. So the dominant channel for a product that sells PHOTOGRAPHY was spending
its best placement on our weakest possible image, and that is what most people
see of this page before they ever visit it.

`brand/og-papic.webp` is the hero frame cropped to 1200×630 — a real Filipino
reception shot taken from a guest's own seat. No baked-in text: the title and
description already render beside the card, and a font we cannot control at
generation time is a font that renders wrong.

### The demo now has a URL you can paste

`/papic/try` — headline, the live codes, one line out to the full page. It
mounts the **same** `<PapicScan />` the main page mounts: same session, same QR
renderer, same realtime channel, same nothing-is-persisted posture. A door to
the demo, never a copy of it. If that file grows its own capture path, that is
the bug.

It was reachable only by scrolling `/papic`, and a section of a page cannot be
pasted into a group chat. **A demo nobody can link to is a demo that cannot
spread.**

### The photographer objection is answered

Our own meta description already made the argument — *"the moments one
photographer can never be everywhere for"* — so the page was making the case to
search engines and not to the couple who has just spent ₱80,000 on a
photographer. It is the objection the supplier channel will hear most.

⚠ Deliberately **not** phrased as a comparison. Papic is not better than a
photographer at anything a photographer does; it covers the room while they
work.

### Checked, not assumed

The fourth item in the brief — *"the page never says Papic lives on your wedding
page"* — was **already true on the shipped page** and needed nothing: it is a
comparison row (*a separate site that expires → lives on your own celebration
page*) **and** a whole section with the Event Hub gallery reproduced in it. The
brief was written against the prototype, where those rows are still stubbed.

⚖ The row says **celebration**, not *wedding*, on purpose: this page ships for
sixteen event types and the repo has a terminology system precisely so a funeral
does not read as a wedding.

11,355 unit tests green (exit 0) · typecheck exit 0 · every blocking lint green ·
port baseline regenerated for the new route and verified to lose nothing (0
destinations, 0 actions across every pre-existing route).

SPEC IMPACT: None.
