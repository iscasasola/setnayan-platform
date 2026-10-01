## 2026-10-01 · fix(rail): More Services reads as a closed sub-menu; captions wrap; the event mark fits whole

Owner, 2026-10-01 (DECISION_LOG "THE SIDEBAR'S MORE SERVICES OPENS AS A VISIBLE
SUB-MENU" and "THE EVENT MONOGRAM IN THE SIDEBAR FITS WHOLE"). On the event rail
the five More Services children now sit in ONE tinted, inset group (`.fd-msub`:
derived tint, thin gold line on the left, smaller icons and word) under a row with
a chevron. The group is CLOSED by default, opens on a tap, and opens by itself when
the current page is one of the five; it is no longer remembered open on the device
(a remembered "open" would bring back eleven rows). On the 72px strip the captions
wrap instead of ending in an ellipsis ("More Serv…", "Setnayan …", "Music Ma…").
The rail's event mark no longer clips: the lockup svgs are cropped tight to their
glyphs and clipped to the viewBox, so a wide capital lost its edge (measured in
headless Chromium); the svg is now `overflow: visible; max-width: 100%`.
Guarded in `one-shell-event-rail.test.ts` (renders the real rail) and
`more-services-is-the-one-row-that-opens.test.ts`.

SPEC IMPACT: None.
