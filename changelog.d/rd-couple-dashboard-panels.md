## 2026-10-19 · feat(tablet): every sheet on the couple dashboard is the one 440-px right panel from 701

Owner-approved 2026-10-19 (DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)", Q2 "440 · one
token"; prototype `prototypes/couple_dashboard_desktop_tablet_2026-10-19.html`). PR 3 of 3 — stacked on PR 1.

- `Sheet` in the couple dashboard (`SHEET_AT.tab`): 22 rem / 34 rem → **27.5 rem (440) for both** — the Suppliers
  date sheet narrows to match, as drawn. Every other surface's `lg` geometry is untouched.
- `SidePanel`: 30 rem from 768 → **27.5 rem from 701**; its phone sheet rises below 701 (was 768). Its one shipped
  user is the launcher's create-event panel, which moves with it.
- The guest card's panel (`.sn-inspector-sheet`): 36 rem from 768 → 27.5 rem from 701 (the rail from 1280 unchanged).
- Hand-rolled sheets on the five area-2 pages adopt the same panel and line: Guests Add a guest · Quick add · Add from
  your people · New group, and the Studio checkout drawer (`InlineCheckoutDrawer`, was a 28-rem drawer from 640).
  The confirm-style dialogs (Replace on your build?, the saved-request loader, the co-host welcome) stay centred
  dialogs but switch on the same 701 line instead of 640.
- Guard: `app/_components/the-panel-is-440.test.ts` (sabotages: SidePanel back to 30 rem → red; Quick add back to
  `sm:` → red).

SPEC IMPACT: None — implements the approved prototype's panel rule as drawn.
