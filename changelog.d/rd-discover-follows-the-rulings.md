## 2026-10-23 · fix(discover): every shelf is a title + one line + one action — details in the ⓘ

Owner, 23 Oct on live prod: *"discover should now change. let us make it now follow what it should
have."* Discover (`/`) keeps its ruled order (your people → the world → shops → people to follow →
stories, DECISION_LOG 2026-09-29) and now follows the later owner rules: no small explainer labels
beside headings (2026-10-01), title + one short line with every detail inside the ⓘ, a frame only on
something you press, dividers not boxes (23 Oct).

- Headings: "soonest first", "soonest first · Metro Manila first", "public events only · the host
  approves who joins", "public profiles, most followed first", "earned, never sold", "not trending —
  one shop cannot trend", "— some with video, some without" → gone or moved into each heading's ⓘ.
  "couldn't load" stays beside a heading (a status, not an explainer).
- Empty or refused shelves: the dashed invite cards and the grey notice box become ONE line + ONE
  button (`empty-shelf.tsx`); the longer words sit behind the line's ⓘ. Shops: "No supplier has
  opened a shop yet." + Open your shop, with the booking-fee terms (still derived from
  `bookingFeeScheduleSummary`) in the ⓘ — one block instead of a line AND a card.
- Guard: `an-empty-shelf-is-one-line.test.ts` renders every empty/refused shelf (sabotaged: red twice).

SPEC IMPACT: DECISION_LOG row "23 Oct: the 1 Oct menu rulings built; Tagalog hidden; Planner mode
removed" (corpus) records the Discover call: where the 2026-09-29 prototype and the later owner
rules differ, the later rules win.
