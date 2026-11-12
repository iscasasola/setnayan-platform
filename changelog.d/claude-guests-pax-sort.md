## 2026-11-12 · feat(guests): Show & sort lists the per-head services — who each one counts

Owner, 12 Nov 2026 (DECISION_LOG "GUEST LIST SHOW & SORT LISTS THE PAX SERVICES"): *"on show & sort. we can add the pax related services"*.

The couple's Guest List › Show & sort gains a topic, **Who each service counts**, with one dropdown per service on the event that is priced per head — "Catering ▾ Everyone · Counted · N · Not counted · N". Flat-priced services never get a row ("PAX CARDS ONLY"): the rows come only from `get_event_service_counts`, whose SQL keeps `event_vendor_counts_per_head`.

- **Not counted** narrows the list to exactly the guests ticked out of that service on their card (`guest_not_counted_for`).
- **Counted** narrows it to everyone that service's supplier counts: attending, counted toward the event, inside the service's rule, not ticked. These are the guests `get_event_service_counts` counts.
- It stacks with Show and +1s. Clear all and the strip's × Clear both drop it. "· N applied" counts it. One service is narrowed at a time.

Extended, not rebuilt: the shipped `GuestsFilterPanel` (`ChosenRow` per service) and the one read the row notes already made. `readNotCountedNotes` became `readNotCountedOnList`, which returns the notes plus the services and each guest's ticks. New pure helpers: `lib/guest-pax-filter.ts` (client) and `lib/guest-pax-rows.ts` (server-built rows). The open sheet is still its own chunk. No schema change.

🔒 `lib/the-list-shows-who-each-pax-service-counts.test.ts`. Sabotage was checked: rows built from any tick go red, and a "Not counted" that also lists declined guests goes red.

SPEC IMPACT: None
