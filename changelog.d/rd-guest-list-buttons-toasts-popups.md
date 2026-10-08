## 2026-10-09 · refactor(guests): the guest list's buttons, toasts and pop-ups come from the shared controls

The six live guest files that drew their own coloured buttons (`send-invite`, `guest-invite-cell`, `guest-ticket-parts`, `add-guest-sheet`, `quick-add-sheet`, `add-from-people-sheet`) now use `ActionButton` with the tone the rule gives each (the forward step is the filled brand button; cancel and manage are neutral; Undo and Skip are quiet), and the three native selects in quick add (Side, Role, Group) are the app's `PickMenu`. Same handlers, same names, same disabled logic; "Add guest" with nobody picked is a WAITING button (still a button). Guard: `the-guest-buttons-are-the-button.test.ts`. No request, no server action, no migration added.

SPEC IMPACT: None
