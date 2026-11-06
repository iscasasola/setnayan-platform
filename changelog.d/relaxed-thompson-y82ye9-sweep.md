## 2026-11-06 · fix(copy): the sweep after the moves — no ⓘ, tour or help line sends a couple to a place that left

Item 5 of the event-menu reorganisation finish — the "ONE SWEEP AFTER THE LAST MOVE" of DECISION_LOG 2026-10-28
("EACH REORG MOVE UPDATES ITS OWN ⓘ, TOURS AND 'WHERE TO FIND IT'"). Stacked on the Home-lines PR (it names Find's
inspiration board, which the Inspiration-in-Find PR adds).

- Tour `customer_event_menu_v1`: "Four places" → **five** (Memories since 23 Oct); Guests = list · map · seat plan ·
  march, replies under its ⚙; Suppliers = Find · Build · Book with the board on top; Hub's Studio = look and words;
  schedule, budget and prints open from Home; a Memories slide (photos + the Thank-You Video).
- Help: the venue-pin answer no longer says "Studio › Info › Venues" (Info left Studio) — the pin is set from
  Suppliers' date-and-place line; Papic credits are added "from the Papic card on Home", not the retired Studio › Papic.
- Build's ⓘ: "Budget is set in Booked › Budget" → "on Home › Budget" (Booked is just the team since 2 Nov).
- "Mood Board & Dress Code" → "Palette + Dress Code" (the tile's name since 28 Oct) in `OUTFIT_SET_IN` and the Invite
  feature page (en + tl). Suppliers' route label "Explore" → "Suppliers"; the no-reply notice says "Find similar
  suppliers in Suppliers › Find".
- Guard `lib/no-copy-names-an-old-place.test.ts` keeps the sweep (sabotaged red three ways).

⚠ Reported, not changed: the Maker's part doors "Open in Studio › Info / Schedule / E-Gifts" are the approved toolbar
prototype's words (pinned by four tests) — where they point now is the Event Hub redesign's call; in the PR for the owner.

SPEC IMPACT: None — copy follows decisions already logged.
