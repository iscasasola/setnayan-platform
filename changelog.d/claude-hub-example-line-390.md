## 2026-11-11 · fix(home): the Event Hub Example's big line never runs under the round buttons

On an empty event, the greyed "Example" under the Event Hub counter drew "Save the Date live" under the tile's two round buttons at 390 px, hiding "live" (at 320 px the wrapped "Date live" did the same).

Cause: the Example is the last block of a Home tile, so it sits on the row where the corner buttons (`.hc-acts` / `.hc-side`, 32-px `.hc-tiny`) are pinned. Its small line already reserved the buttons' width, but it was only one text line tall, so the big line above it landed in the buttons' 32-px row with nothing reserved.

Fix (`app/globals.css`): in a tile that has corner buttons, the Example's small line is exactly as tall as a button (`line-height: 32px`). The small line owns the buttons' row (width already reserved), and the big line keeps its full size, wraps freely and always ends above the buttons, at any width. A tile with an Example and buttons grows by 14 px. Held by `app/dashboard/[eventId]/_components/an-example-never-runs-under-the-buttons.test.ts` (the rule exists and is at least the `.hc-tiny` height; every Example beside corner buttons has the shape the selector matches, Event Hub included). Sabotages went red: deleting the rule, `line-height: 18px`, wrapping the hub tile's `.hc-side` in an extra span.

SPEC IMPACT: None
