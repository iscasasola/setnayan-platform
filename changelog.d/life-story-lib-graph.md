## 2026-07-08 · feat(life-story): MomentGraph builder + fixtures + rollout flag (PR-2, lib)

The data layer of Life Story (own-events, Phase 1):

- `lib/life-story-moment-graph.ts` — pure `assembleMomentGraph()` core (person linking via `guests.person_id`, burst clustering ≤20s, ±90s coverage windows, distinct-event recurrence, scoring) + thin `fetchMomentGraph()` RLS query layer. **Scope guard:** events via `event_members.member_type='couple'` only — attended-events / `person_story_items` stay counsel-gated (Phase 1.5). Sparse dignity: empty events remain in `events[]` with their hero image (chapter cards at the UI layer — implemented as events metadata rather than the plan's low-weight pseudo-moment, keeping scoring media-only).
- `lib/life-story-fixtures.ts` — deterministic demo graph (1–8 events, prototype cast incl. ✦ Lola) running through the REAL assembly path; page-layer gated to dev/preview.
- `lib/life-story-flag.ts` — `lifeStoryEnabled()` reading `NEXT_PUBLIC_LIFE_STORY` (default off; rollout switch, distinct from the counsel-gated flag).

10 new node:test cases on the pure core (clustering, coverage, capturedBy resolution incl. unclaimed seats + quota-only rows, recurrence, ✦ flow-through).

SPEC IMPACT: None (implements `03_Strategy/Life_Story_Build_Plan_2026-07-08.md` §4; the sparse-dignity delta from pseudo-moment → events-metadata is noted there-in-line by PR-3).
