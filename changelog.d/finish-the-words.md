## 2026-08-18 · fix(event-hub): S13 is finished — the guest tree speaks the event's own words

**What a person gets.** A birthday, a graduation, a corporate day or a trip now
reads as itself everywhere a guest goes: the invitation, the day-of screens, the
seat rooms, the gift page, **the story after the event**, and the printable
keepsake. **A wedding is byte-identical throughout**, and that is asserted.

**Measured before → after: 40 guest-read wedding words → 0 that are not
deliberate.** 31 sentences rewritten across 14 files.

**The story page was the densest pocket left** — eleven sentences including two
Title-Case headings (*"The Wedding Day (Live)"*) and **three screen-reader
labels a sighted reader never sees**. Seven of its sub-components now take the
words; the top-level one resolves them from the event id via the request-cached
`resolveProfileByEvent`, so nothing is threaded through components that have no
other business with it.

**New:** `eventWordsForEvent(eventId)` — for the deep components that receive
only an id (the story, the face notice, the guest column card).

**Also changed:** the widget renderers now carry the whole `EventWords` object
rather than the single `organizer` string added yesterday — several widgets need
the EVENT word as well as the PERSON word, and two props would have been two
things to forget.

🛡 **`s13-is-finished.test.ts` — the guard that keeps it finished.** It scans the
rendered text of the entire guest tree, strips comments (several files now
EXPLAIN this work, and prose about the defect must not read as the defect), and
pins the survivors as an **EXACT-MATCH bill of 24 files, each with the reason it
is allowed**.

🔑 **A ZERO HERE WOULD BE WRONG.** Per the owner's ruling — *"there are parts
that is dedicated for weddings but there are parts that should also work for non
wedding/other events"* — the bill deliberately keeps four BUCKET 1 files (the
tea ceremony, the love story, the cinematic openings, the bride's/groom's
sides). **Removing one of those FAILS the guard too**, so flattening a wedding
is caught in the same test as forgetting a birthday.

**Mutation-proved, occurrence counts printed:** a resolved sentence reverted to
a literal (1→1) **1 fail** · a BUCKET 1 exemption deleted, i.e. a wedding being
flattened (landed) **2 fail** · restored **3 pass**.

⚠ **NOT OBSERVED beyond two hand-made test events.** Production holds no real
birthday or graduation, and the two the owner asked me to create were written
straight to the database rather than through the create screen — good enough to
read words on, not a fair test of anything else.

⏭ **What S13 does NOT cover, and is not a gap in it:** a birthday can still be
handed the wedding save-the-date film and a wedding-style monogram, and a
birthday page still shows a **Story** tab. Those are BUCKET 1 parts leaking to
the wrong event type — **S15**, which the owner's grid unblocked and which is
where the Event Hub stops merely sounding right and starts being right.

SPEC IMPACT: None.
