## 2026-09-27 · fix(nav): the event's settings row wears a gear and says "Event settings"

Owner: *"make a settings icon"*. Under the event's mark and name in the side menu, the row read "Details ›" and opened Event Settings (names, date, venues, guest count), while "Details" is also the Event Hub Maker's include-checklist page, so one word named two places. It now shows a ⚙ gear with "Event settings" (`event-rail-context.tsx`, two CSS rules in `front-door.css`). Same link, same active state.

SPEC IMPACT: None.
