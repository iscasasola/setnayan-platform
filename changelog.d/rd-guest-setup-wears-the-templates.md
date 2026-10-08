## 2026-10-09 · refactor(guests): Guests › Setup's writes come through the lab's stand-ins

Step 3A. Guests › Setup's three writes — the asks and how guests get in (`hubDraftAction`, the Maker's draft door), Reply by (`updatePaxSettings`) and Finalize / Reopen (`setGuestListFinalized`) — are taken from `GuestActionsContext` like the rest of the list's writes, so the dev lab's `?part=setup` can be pressed without reaching the database (`?refuse=1` makes them refuse in the database's own words, on purpose). The app never provides the context: production calls the shipped actions. No request, no server action, no migration added.

SPEC IMPACT: None
