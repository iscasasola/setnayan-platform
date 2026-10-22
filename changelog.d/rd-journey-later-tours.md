## 2026-10-22 · feat(tours): the host's five page spotlights; a missing doorway takes its page with it

Owner 2026-10-22, "yes to all" on `prototypes/journey_fixes_later_2026-10-22.html` § Host 4 + Simple-event stall:

- **Five first-visit spotlights** (`lib/tours.ts`, new keys so a host who dismissed an old carousel still meets them
  once): **Maker** `customer_event_hub_maker_v2` (A — the quiet line · the lower third · Apply; mounted by the
  Maker's own page, `inMaker`; ⋯ › About the Maker replays it), **Budget** `customer_budget_v2` (3), **Papic**
  `customer_papic_v2` (4, no price), **Seat plan** `customer_seat_plan_v2` (3, phone words), **Mood Board**
  `customer_mood_board_v1` (3). Each after `host_spotlight_v1` (`lib/host-page-tours.ts`); inside the Maker, the
  Mood Board and Seat plan wait for the Maker's own tour. No stop repeats the journey's. The Budget, Papic and Seat
  plan MiniTour mounts are gone. "Show me around" plays the page's own tour where there is one.
- **Engine — a missing doorway takes its page with it** (`lib/spotlight-drops.ts`, Option A): while a step's page
  is on screen, a step of it not drawn after 3 s is dropped — a doorway with the page behind it — and "Step N of M"
  is counted from what is left. A Simple event's journey now reaches "You're set" instead of sitting silent. A page
  that is merely elsewhere (the event-type picker) drops nothing. Also: the engine no longer pauses under the Maker
  for an `inMaker` mount; a `pointer-events: none` line can be lit; a step taller than the screen scrolls to its top;
  a step inside a scroll box within a fixed shell scrolls; a step may carry its own hint line ("Press Next").
- **Claim re-checked**: the Mood Board's "Your Event Hub's look … read from here" is true — the Hub's look IS the
  board's five main colours (`lib/main-colours.ts`, "one palette, not a copy").

Guard: `apps/web/lib/the-host-page-tours-land.test.ts` (scripts · mounts and their order · the Maker pause · the drop
rule on the real journey: Simple Home → finale with an honest count; full Home and the picker drop nothing).

SPEC IMPACT: None beyond the DECISION_LOG row "JOURNEY FIXES — THE LATER LIST" (corpus 10df37b0).
