## 2026-10-09 · refactor(guests): the guest list's buttons, toasts and pop-ups come from the shared controls

The six live guest files that drew their own coloured buttons (`send-invite`, `guest-invite-cell`, `guest-ticket-parts`, `add-guest-sheet`, `quick-add-sheet`, `add-from-people-sheet`) now use `ActionButton` with the tone the rule gives each (the forward step is the filled brand button; cancel and manage are neutral; Undo and Skip are quiet), and the three native selects in quick add (Side, Role, Group) are the app's `PickMenu`. Same handlers, same names, same disabled logic; "Add guest" with nobody picked is a WAITING button (still a button). Guard: `the-guest-buttons-are-the-button.test.ts`. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · refactor(guests): the guest list says it with the approved toast, and the toast gains Undo

`PeekToast` takes one optional `action` (a small pill at the right, e.g. "Undo"): the toast then stays 6 s, only that pill takes a tap, it is a polite live region — and with no action its markup is unchanged byte for byte. The removal's Undo (`UndoToastHost`) is now that toast from the top (same `runUndo`, same 6 s window); the old `useToast` calls in the capture bar, the delete flow, the guests screen and Regenerate QR, and quick add's hand-made pill, are `PeekToast`. `ActionButton` gains one optional `name` prop (the accessible name; absent, the `aria-label` is the word as before) so a row's Invite is named for its guest. The app-wide `ToastProvider` is not moved. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · fix(guests): a refused delete says so; the Undo toast leaves like the others; Delete/Cancel/Regenerate are buttons

A press now ends its own "Deleting…" on every path (`finally`), rolls the hide back and says the refusal in the red top toast and in the sheet; the sheet's heading keeps the name it opened with ("Delete Daniel Ramos?" while it runs, not "Delete ?"). The Undo toast no longer vanishes at 6.0 s: the undo window closes (Undo is a no-op from then) and the toast slides back up like every other `PeekToast`, cleared when it has gone. `DeleteGuestSheet`'s Delete (danger, main) / Cancel (neutral) and the invite page's Regenerate QR are `ActionButton`. The dev lab's delete and undo are local stand-ins (`?refuse=1` makes them refuse) and the lab mounts the toast host the real page mounts. No request, no server action, no migration added.

SPEC IMPACT: None
