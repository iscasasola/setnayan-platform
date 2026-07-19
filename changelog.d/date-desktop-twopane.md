## 2026-06-22 · fix(onboarding): date screen uses the two-pane desktop layout (maximize space)

Owner: "desktop is not maximizing space" — the date screen rendered as a narrow centred ~700px
column in the wide (1180px) desktop sheet, leaving the right half and the lower area empty.

The date screen wasn't opted into the desktop two-pane layout, even though `DateCalendar` already
renders the standard `.viewzone` (eyebrow + headline) + `.tapzone` (toggle + calendar) skeleton that
the two-pane CSS targets. Added `onb-twopane` + `id="screen-date"` to the date `<section>`, so on
desktop the headline ("When's the big day?") anchors the LEFT column and the mode toggle + calendar
fill the RIGHT — consistent with role/kind/faith, filling the canvas. Mobile (<1024) is unaffected;
no CSS or component changes (the existing two-pane rules do the work).

Browser-verified at 1280px.

SPEC IMPACT None (desktop-only layout consistency).
