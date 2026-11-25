## 2026-11-25 · fix(supplier): final check area 5, lane B 4 — Team's Roles in place; Theft Watch and Track record rise

- **B13** Team › Roles opens in place inside the risen Team layer (`/vendor-dashboard/team?section=roles`): the head reads
  "‹ Roles" over Team; ‹ goes back to Team. The Roles page's grey back box and its own title are gone; every row, the
  rename boxes, Save names, the plan line and the Who gets new inquiries row stay. `/team/roles` forwards there.
- **B14** Who gets new inquiries opens in place one level under Roles (`?section=inquiries`; ‹ back to Roles). The branch
  is one dropdown (the house PickMenu) instead of a row of pill links; Adjust opens under its own group, in place.
  `/team/roles/inquiries` forwards there, carrying branch / adjust / type. Saves land back on the section.
- **B15 · B16** Theft Watch and Track record rise from the Shop shelf in the shared layer (full screen on a phone, the
  centred dialog from 701); inside it the page's pinned ‹ row steps aside (`ToolPin`); a hard load keeps it.
- `BackWhenNotRisen` now covers the centred dialog too; lane B 2's duplicate `HideWhenRisen` is folded into it.
- Guards: `team/roles-open-in-place.test.ts`, `shop/the-shelf-tools-rise.test.ts`.
- Depends on #8341, #8353 and #8320 (built on them).

SPEC IMPACT: None.
