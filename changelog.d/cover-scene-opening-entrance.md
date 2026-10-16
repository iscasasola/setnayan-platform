## 2026-10-16 · feat(cover-scene): Style = the Opening (the Reveal tile is gone), Animate = one entrance, ▶ veil → unveil → entrance

Owner-approved 2026-10-16 (DECISION_LOG "APPROVED — THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE…", "ALL
ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆"); prototype `cover_scene_edit_animate_2026-10-16.html` v2.
Part 2 of 2 — part 1 is #6592 (merged).

- **Cover Scene has all four tools.** Style is the Opening: the shipped reveal picker (`RevealPartTools` — None free ·
  Sheer veil ◆ · …), mounted as the group's own rows. The Reveal's tile that floated above the cover ("Opens once, over
  the cover") is gone from every page list and from the canvas (`revealStubHtml` deleted); the cover's top-right corner
  names the opening instead ("Sheer veil ◆ opens over it" / "No opening", Maker canvas only). Nothing can be added above
  the Cover Scene (the Reveal's lock moved onto the group). On Post Event (no opening) its Style is the work area's own, as before.
- **Animate = ONE entrance** (`lib/cover-entrance.ts`): Entrance ▾ (The theme's own · Event title first · Top to bottom ·
  All together · Soft focus · From the sides · Still), Movement ◆ (Quick · Calm · Cinematic), the beats (at most three —
  the shipped Delay steps), and the words on their own with "Reset to the cover's ›". Stored ONCE as `canvas.entrance` on
  the hero row and resolved at read time onto every word with no Build in of its own (page, lab and the canvas's instant
  preview alike); the RSVP button enters last. A word's own Animate says "Follows the cover's entrance — …" and, once its
  own, offers "Reset to the cover's entrance ›". Pro at Apply (motion), like a part's own motion.
- **▶ on the Cover Scene** plays the closed veil with none of the words → the unveil → every line in its beat
  (`play-sequence.ts` `playCover`); no opening: the entrance alone; reduced motion: nothing, and it says so.
- Guard: `lib/the-cover-scene-has-its-own-animate.test.ts`.

SPEC IMPACT: None — implements the 2026-10-16 corpus rows as written.
