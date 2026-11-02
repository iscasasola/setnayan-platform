## 2026-10-17 · feat(love-story): two voices — Conversation (default), Two-lane timeline ◆, Swipe cards ◆

Owner-approved (DECISION_LOG "APPROVED — LOVE STORY, TWO VOICES", corpus c0523c25; prototype
`prototypes/love_story_two_voices_2026-10-17.html`).

- **Data:** each moment may hold `voices = { a?, b? }` beside `line` in `events.love_story.moments[]` — slot-keyed
  (a = the first partner, b = the second, in `splitCoupleNames` order via the new `loveStoryPartners`), ≤ 600 each.
  No migration (additive JSONB key). `readMoment` keeps a moment with a voice and no line. The form reads
  `voice_a` / `voice_b`; a moment needs a year and one of line · voice a · voice b; a form without the line keeps it,
  so writing a voice never blanks the line told together.
- **Maker sheet** (`moment-sheet.tsx`, `moment-sheet-studio.tsx`, shared `moment-voices-fields.tsx`): "A line or two"
  becomes two fields under the partners' names. A moment written before has its line in a folded, editable "Told
  together" row until a voice is written. "Added by" hides once both voices are written (controller's call, recorded).
- **Guest looks** (`our-love-story-styles.tsx`): `conversation` (free, the Love Story scene's new default on the Save
  the Date and the Invitation), `timeline` and `cards` (◆ Pro). Each draws only the voices that wrote; none → the line.
  Chapters / Essay / Years unchanged, except a voiced moment reads its voices, named. Look choreography plays only when
  the scene has an Animate entrance (already Pro).
- **Pro:** `lib/scene-style-pro.ts` names the Pro looks by scene type; the Apply gate gains a `style` canvas facet
  (`canvasLookFacets`, threaded scene type) — tried free in the Maker, named at ✓ Apply ("Two-lane timeline · Love
  Story"), the event's unlock covering everyone on it. ◆ shows in the Style dropdown and on the look cards.
- **Also:** live preview hooks `data-love-voice-a/-b`; prints name each voice ("Maria: … · Jose: …"); dev lab
  `/dev/maker-lab/guest?love=<look>`; guard `lib/a-moment-shows-only-the-voices-that-wrote.test.ts`.

SPEC IMPACT: None beyond the approved DECISION_LOG row (corpus c0523c25) — this builds it. The default look of the Love
Story scene changes from Chapters to Conversation on live pages, per the owner's ruling.
