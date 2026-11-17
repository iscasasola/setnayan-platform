## 2026-11-15 · fix(live): the Online/Offline switch flips the moment it is pressed

Owner: *"pressing online offline takes too long to update"*. The switch under every service card and bundle card drew
only the server's `isActive`, so it moved only after the whole save (gates, update, revalidates, the page's re-render).
Now `ServiceCardMenuRow` draws where the switch is going (`pendingTo ?? isActive`) with one "Going online…/offline…"
line under the row; a refusal or failed send flips it straight back (new `StayForm` `onRefused`, called on every
refusal) and still prints under the row, and a landed save hands back to the server's state. The bundle card flips
its own `live` the same way and reverts on a refusal. Every server gate is unchanged; no new server action. Guard:
`app/vendor-dashboard/services/the-online-switch-flips-at-once.test.ts`.

SPEC IMPACT: None.
