## 2026-10-19 · feat(tablet): the couple dashboard's pages sit in the system's two columns

Owner-approved 2026-10-19 (DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)", prototype
`prototypes/couple_dashboard_desktop_tablet_2026-10-19.html`). PR 2 of 3 — column caps only; no page is redrawn.

- **Reading column, 48 rem:** Guests List/Setup (`.screen`, was 720 px), Budget (`sn-col max-w-3xl`, was 64 rem),
  Papic (a centred `max-w-3xl` wrapper, was uncapped). Home already carried `lg:max-w-3xl` — unchanged.
- **Wide stage, 64 rem:** the Guests Map (was uncapped) and the Suppliers takeover (centred `max-w-5xl`; the list
  keeps its own 820-px column inside, and the inspector its in-flow space from 1280).
- A phone never reaches either cap, so below 701 nothing moves.
- Guard: `app/dashboard/[eventId]/the-columns-are-the-system.test.ts` (sabotage: the Map uncapped → red).

SPEC IMPACT: None — implements the approved prototype's column rule as drawn.
