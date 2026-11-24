## 2026-11-24 · feat(hub-tools): ten more free hub tools on the supplier's Hub — checklists, per-person sheets and the Ordered list

DECISION_LOG "Seven open calls settled" item 3 (the free rest, part 1 of 2; controller OK 24 Nov on the list). Same shape as the first ten (#8247): ONE table `vendor_hub_tool_entries`, ONE reader `readHubToolEntries`, ONE writer `hubToolEntry`. No new table, no new server action, no migration. Drawing `prototypes/hub_tools_working_2026-10-28/`.

- **Checklist:** Ceremony details · Proofs & approval · Safety permit & cue. The couple sees the ticks on their supplier workspace (`hub_tools.couple_sees`, already on for every checklist).
- **Per-person sheet:** Fittings & measurements · Looks per person · Crew roster · Room list.
- **Ordered list (new template):** Chair schedule · Reservation slots · Brackets & scoring.
  - Numbered rows, one place up or down with ▲ ▼ (the Set list's idiom). The dispatcher's new `move` op swaps the row's position with its neighbour **in its own tool**: two writes, never a renumber.
  - Brackets & scoring keeps a score per row in `qty`, with − / ＋. The score and the Counter share one settle-then-save stepper (`useCountSteps`).
- Each tool is a day-of module any shop may switch on, ON for nobody by family; Admin › Categories › Hub tools suggests them per booking.
- **The one writer serves only shipped tools.** A held tool (Insured people list) is refused, as are tools whose rows live elsewhere (Set list, Song Desk, Shot list), whatever their shipped flag says.
- **Held, with reason (controller 24 Nov):**
  - Insured people list and Incident log: privacy picks, waiting on the owner.
  - Photo upload and Photo delivery: a later batch.
- Lab: `/dev/supplier-hub-tools-lab?s=rest` (with `rest-empty` and `rest-unread`).
- Guard: `lib/the-ten-more-hub-tools-work.test.ts`.

SPEC IMPACT: None. This builds the ruled item 3. Templates follow `lib/hub-tools.ts`, which the database `hub_tools` holds. The 28 Oct drawing's own map differs for a few tools (e.g. Reservation slots as a counter, Brackets as a log); the Tool maker can change a template later.
