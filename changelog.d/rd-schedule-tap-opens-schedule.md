## 2026-10-06 · fix(maker): a tapped Schedule (and a save in any Details item) never lands on "Which stage do you want ready?"

Two live owner reports on desktop, one symptom: the Event Details guided
flow's stage list appeared instead of the thing he was editing.

1. **"why do i jump here when i tried to tap on the schedule"** — on an
   unfinished event the launch page opens Details on the guided flow for a
   plain landing. Details is unmounted while the canvas shows, so a schedule
   moment tapped on the canvas set the Maker's item to `schedule` and mounted
   Details fresh, on the stage list the server had chosen. Now a door that
   names ONE item goes through the Maker's `openDetailsItem`, which sets the
   item and counts the visit (`itemVisit`, answered once — the mechanism Look
   already used, `lookVisit`). Details answers it by leaving the flow's screens
   for that item, so the item's editor opens in place. The same door now
   carries the couple's mark (→ Logo), Page ▾ › Love Story, the draft bar's
   Look jump and a `?open=` Look row. `setDetailsItem` stays a report.
2. **Seat plan › Auto arrange landed on the stage list** — Details keeps its
   place in the address (`?tool=details&item=…`) with `replaceState`, but it
   passed `window.history.state`, which carries Next's `__NA` marker, and
   Next's patched `replaceState` ignores any call carrying it. The router kept
   the landing address, so a save (a server action) re-rendered the page AT
   THE LANDING, the address bar snapped back to it, and the next reload or
   remount opened the stage list. Details now passes `null`, so Next copies its
   own state in and hears the address.

Measured in `/dev/maker-lab` at 1440 and 375 px. Guarded by
`apps/web/lib/a-named-item-door-opens-its-item.test.ts`, which was sabotaged
red on each part of both fixes.

SPEC IMPACT: None.
