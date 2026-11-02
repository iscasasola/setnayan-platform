## 2026-09-21 · feat(invitation): the pass states the four facts a door needs

Last slice of the arrival design. The QR already shipped; what it lacked is everything a pass is
FOR. Someone at the door asks who this is and where they sit, and the card answered neither.

The pass card now prints **Guest · Table · Arrive · Bringing** above the code, at `PASS_ANCHOR` —
the same anchor the arrival action's "Show your pass" links to, which travels with the card when
the day-of reorder moves it.

🔑 **EVERY FACT IS OMITTED WHEN IT DOES NOT EXIST.** No "Table TBA", no invented time. A pass that
states a table the couple never assigned is worse than one that stays quiet: the guest believes
it, walks to a table, and is moved in front of other people. Each absent fact drops its own row,
not the whole card, and a guest with no name gets the plain QR card rather than an empty pass.

Two decisions worth naming:
· **ARRIVE is the FIRST block of the day, never the next one.** A pass read at 9pm must not tell a
  guest to arrive at the send-off. Formatted in Asia/Manila — the event's own day, not the
  server's.
· **Permission is not a person.** `plus_one_allowed` is the couple saying yes to a companion; it
  is not a companion. The "Bringing" line needs the allowance AND a name, or a pass would announce
  a seat nobody claimed.

Guarded by `lib/the-pass-is-a-pass.test.ts` (7 tests). Making the table fall back to "TBA" turns
two of them red.

⚠ One thing this slice itself tripped over: the test's "the resolver never reads a boolean" check
first failed on the resolver's own DOCBLOCK, which explains `plus_one_allowed` in prose. It now
strips comments with the ONE shared stripper — the same trap `lint-one-comment-stripper` exists
for, met from the other direction.

Not seen by a real guest yet.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 row — the pass.
