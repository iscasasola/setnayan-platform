## 2026-07-08 · feat(life-story): significance engine + beat compiler (PR-1, pure lib)

The Life Story engine's pure core — no DB, no UI, fully unit-tested (node:test):

- `lib/life-story-types.ts` — MomentGraph data contracts (Moment / CapturedBy / MomentPerson…). Own-events scope only; `person_story_items` deliberately unrepresented (counsel gate).
- `lib/life-story-significance.ts` — tunable `scoreMoment()`: memoriam .28 · recurrence .24 · people .18 · eventType .16 · coverage .08 · pin .06 (reserved) + bounded reminiscence-bump bonus (+.05, viewer age 10–30, silent without birth_date). Deterministic ordering.
- `lib/life-story-beats.ts` — `compileBeats()`: face_open → weighted moments (burst-deduped, event-breadth aware) → perspective turn → opt-in ✦ memoriam hold (longest dwell) → present_forward, ALWAYS last (owner-locked alive-framing). ≤8 beats (bounded-arc evidence).

Tests pin ordering behavior + the arc's invariants (ends forward always; ✦ never synthesized; ≤ MAX_BEATS).

SPEC IMPACT: None (implements `03_Strategy/Life_Story_Build_Plan_2026-07-08.md` §3 as planned).
