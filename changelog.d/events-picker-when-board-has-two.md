## 2026-09-19 · fix(launcher): "Events 2" lands on the board so you can pick

Owner, live as testnayan4 (organises one wedding, invited as groom on another): the
rail said **Events 2** and pressing it jumped straight into one wedding — *"shouldn't
it let me pick which event first?"*. The landing auto-jump was decided from the
ORGANISER-only set while the board and the rail counted every membership.

- `landingJumpTarget` (lib/event-board.ts, pure): jump only when the WHOLE board —
  organiser + invited, non-archived, with a stance — is exactly one card, that card
  is the person's own, and it is still upcoming. The launcher feeds it `boardEvents`.
  `?hub=1`, past-only → board, and the 0-event console → create-event rule unchanged.
- Rail "Events" count now counts the same set the board shows: member types
  `couple` + `guest` only, distinct events (a coordinator row added a card the board
  never shows — 1 live prod account).
- `home-is-reachable.test.ts` now EXECUTES the decision (≥2 cards never jump; exactly
  one upcoming own card does; finished / invited-only / put-away cases) and pins that
  the launcher passes `boardEvents`. Sabotage-proven 4 ways.

Measured on prod (read-only): 1 account hit this — testnayan4@test.com (test).

SPEC IMPACT: DECISION_LOG.md row added (landing rule refined, owner 2026-09-19).
