## 2026-10-07 · feat(maker): the Wedding March waits for Apply

Owner 2026-10-06 (DECISION_LOG "THE WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH
MAKER"): *"Wait for apply"*. Every march drop (swap · walk together · walk
alone · move · section drag · into or out of "Not walking") is now an Event Hub
draft entry instead of a live write:

- `lib/hub-draft.ts` — the draft holds `march`: one entry per drop, each the
  drop's shipped march steps. A save ADDS its move after the drafted ones
  (`march`); `marchUndo` takes the last back off. The ✓ Apply sheet names it as
  one line, "Wedding March · N changes". Free, never Pro.
- `lib/march-draft.ts` (new, pure) — step sanitising, the 60-move bound, and
  `runDraftedMarch`, Apply's in-order replay: a refusal ends it (the moves
  before are live, the rest dropped, said as "Wedding March stopped partway");
  a step that could not be sent stays drafted with everything after it.
- `lib/march-drag.ts` — `replayMarch`: the live march with the drafted steps
  laid on, the way each shipped action leaves it; the loader draws the march
  through it, so a drafted move is drawn where it was dropped.
- `website/hub-draft-actions.ts` — Apply replays the steps last, through
  `guests/march-step.ts` (new, NOT a server action — the maker's old `callStep`
  moved to the server; +0 exported server functions). Save refuses past the
  bound in words.
- `launch/_components/details-march.tsx` — a drop is a draft save (loaded at
  the first drop; opening the march writes nothing); the toast's Undo is
  `marchUndo`; "Guests see this right away" and `data-writes-live` removed
  (guard (22)'s opt-in count lowered to Reply by only). An unread draft says
  "The march couldn't load — Retry" instead of planning on the wrong march.

Guards re-pointed (the design moved, per the ruling): the live-writer lists in
`every-maker-form-drafts-or-says-so` and `the-guided-steps-share-one-layout`
(20)/(22); the dispatch checks in `a-pair-walks-as-one-line`,
`details-your-event`, `the-march-moves-without-a-reload` now read
`guests/march-step.ts`. New: `lib/the-march-waits-for-apply.test.ts`.

Open owner question kept as today's behaviour: a sponsor taken out of a pair
prints alone at the end of their section (ROADMAP_TO_APPLE_CHECK §2.1).

SPEC IMPACT: None — implements the 2026-10-06 DECISION_LOG row as written.
