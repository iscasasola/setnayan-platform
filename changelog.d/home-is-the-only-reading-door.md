## 2026-08-20 · change(frontdoor): Stories folds into the chips — the rail's second door to one shelf is retired

Owner, 2026-08-20: *"on home, we have the [all, articles, their stories, with
video] buttons to filter out. what we want is the stories menu to be inside
this as well."*

**The rail's "Stories" destination was a second door to the shelf four inches
to its right.** The front-door feed and `/realstories` read the SAME three
voices from the SAME loaders — owner-featured storyteller chapters, consented
showcases, the Journal — and the chip row over the feed already carried "Their
stories". Pressing the menu item landed a person on the same pieces in
different chrome.

- The `Stories` row is removed from the rail's destinations group (`Home ·
  Marketplace` remain), along with its now-unused icon import.
- `railMatchRows` no longer declares `/realstories`, so it lights no row —
  `activeRailKey` returns `null`, which renders as "no row lit". It is
  deliberately NOT mapped onto `home`: a row lit on a URL that is not its own
  is the exact defect this file already records.
- **The hub is not retired and must not be orphaned.** `/realstories` keeps its
  address and still carries what the chips do not (the event-type filter and
  the search box), and it is where storyteller SEO equity is deliberately
  concentrated — chapter detail pages are `noindex` so the hub keeps it. The
  "Stories" **shelf heading** is now the permanent link to it.

🔑 **THE ONLY OTHER LINK ON THE PAGE IS CONDITIONAL.** The existing
`/realstories` link lives inside the real-weddings written invitation, which
renders exclusively while that grid is UNEARNED — it disappears the day the
second couple publishes. Retiring the rail row without promoting the heading
would have left the hub with zero links from the front page at exactly the
moment it started to matter.

🛡 Two new guards, both mutation-checked by occurrence count: the feed must
hold ≥2 links to the hub AND specifically the heading one; the rail must render
zero. `rail-active.test.ts` gains the inverse assertion a hand-written list
always forgets — a *declared* row nothing renders can never light either, so
`/realstories` must be absent from **both** sides.

⚖ **MARKETPLACE IS DELIBERATELY UNCHANGED.** The owner asked whether it should
go too, since suppliers are picked inside an event plan. It already is inside
one — every event's Suppliers page carries its own marketplace search and
per-category "find" links. Removing the top-level destination would add
nothing and would hide suppliers from anyone who has not started an event,
while orphaning the fifteen category shortcuts beneath it, whose parent it is.

SPEC IMPACT: None (navigation composition; no SKU, price or schema change).
