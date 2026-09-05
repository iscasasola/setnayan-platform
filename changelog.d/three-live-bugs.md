## 2026-09-06 · fix: three live bugs — a duplicated rail row and three false claims on /features

Owner: *"fix bugs"*. Found by measuring rather than reading — every in-event row from all four rail
groups was listed and grouped by destination, and every mechanical claim on `/features` was checked
against shipped code.

**1 · Mood Board appeared TWICE inside an event.** `plannerRailItems` carried it on the reasoning
recorded in its own file — the board *"lives inside Studio → Branding, not the event's own
top-level menu"* — which was true when written and became false on **2026-09-03**, when the owner
promoted the Mood Board into the Studio rail group (*"i do not see it"*). From that day the rail
showed **Mood Board → the same href** in both Studio and Planner. Three days, unnoticed.

The Studio row stays (it is the owner's own ruling); the Planner one goes. Planner is not dead —
`plannerDoorwayRows` fills it outside an event; inside one it is now genuinely empty, and an empty
array renders no group rather than a heading over nothing.

🔴 **And the guard that should have caught it could not.** `free-tools-rail.test.ts` compared
Planner only against `EVENT_MENU_HREFS`, so a collision with the **Studio group** was outside
everything it looked at. It now checks both, for Planner and Builder, against the real
`railToolsSignedIn` list. That widening is the actual fix; emptying the list is only today's
consequence of it. (The two Together pairs that share a destination are deliberate and
`front-door-shell.tsx` says so — they are excluded, not silently swept in.)

**2 · `/features` advertised three things that do not exist**, in English *and* Tagalog, on a live
public page:

- *"Subscribe to .ics so it syncs to your phone"* (Schedule) — **no calendar export exists for the
  schedule.** The only `.ics` in the repo is the save-the-date link, the budget due-date feed and a
  single vendor appointment.
- *"When you adjust a block, every vendor on that block gets a notification"* — **nothing notifies
  on edit.** The route's only `emitNotification` fires when the couple resolves a vendor's
  suggestion.
- *"Every payment ties back to a vendor and an OR, no orphaned line items"* — **both halves false.**
  There is no OR field, and `event_costs` exists precisely so a cost can have no supplier (the
  rings, the licence, tips) — `a-cost-needs-no-supplier.test.ts` is that feature's own guard.

Replaced with what the code does. The Schedule mock's **".ics synced"** chip became "Live for
guests", which is the shipped behaviour.

SPEC IMPACT: None — these correct copy to match shipped behaviour and remove a duplicate row.
