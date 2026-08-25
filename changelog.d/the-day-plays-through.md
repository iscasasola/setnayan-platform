## 2026-08-25 · feat(samahan): a samahan's day can be watched, not just sampled

The stories strip showed a row of thumbnails and the viewer opened exactly one clip — on `loop`,
behind a close button. So a day made of 3-second clips, which is the entire Setlog rhythm the
feature was built around, could never be watched through: you tapped, watched three seconds
repeat, closed, tapped the next.

`loop` was the mechanism. A looping clip has no end, so there was no moment at which anything
could come next.

- **The day plays forwards.** The strip stays newest-first (it answers "what is new"); the reel
  runs oldest → newest, so tapping any clip plays from there to now, and **Play the day** starts at
  the beginning.
- Each clip plays once and hands over. Position ("3 of 7"), a segment bar, Back/Next, and arrow
  keys + Escape.
- Taking your own clip down now steps to the next one instead of dropping everybody out of the
  day.
- Ordering moved to `lib/samahan-reel.ts` (`orderTheDay`) — pure, non-mutating, and unit-tested,
  because sorting the page's own list in place would silently reorder the strip too.

🔑 **Nothing is stitched and nothing is kept.** These are the same clips that already expire in 24
hours, played one after another. What a samahan KEEPS after 24 hours remains an OWNER DECISION
(`WHATS_NEXT_Samahan_2026-08-24.md` § 3.1) and this does not answer it.

🪤 **The guard's first comment-stripper ate 8,350 characters of the component** — a third of the
file — and then reported that the "Play the day" button did not exist. The culprit was the
attribute `accept="video/*"`: inside that string `/*` opens a comment as far as a regex is
concerned, and it ran to the next `*/` thousands of characters later. Replaced with a state
machine that knows when it is inside a string. Six mutations, each measured before → after, all
red — including one that first stayed GREEN because it matched a line `goTo` also contains, and is
now scoped to the function it is about.

SPEC IMPACT: None.
