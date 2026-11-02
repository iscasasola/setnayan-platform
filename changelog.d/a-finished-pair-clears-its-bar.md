## 2026-09-20 · fix(guests): a finished pair says so, and lets the selection go

`pairSelectedGuests` redirected with `?paired=2`, but `page.tsx` had never heard
of `paired`. It was missing from all three registries every other bulk action
joins:

- the `searchParams` type,
- `pickFlash` — so a completed pair produced NO confirmation at all,
- `recentlyApplied` — so the floating SelectionBar kept showing "2 selected"
  for the two guests the action had just finished with.

Owner, verbatim: *"after applying the selected, this should already reset and be
gone since the task is complete."* Apply/group/side already cleared correctly;
pairing never joined the mechanism that clears them.

`unpaired` gets the type entry and the flash, but deliberately NOT the bar
retraction: it fires from one row's own control, not from the selection, so
clearing on it would discard a selection the host is still assembling.

Guarded by `app/dashboard/[eventId]/guests/a-finished-action-clears-its-bar.test.ts`,
which DERIVES the flag names from `pair-actions.ts` rather than listing them —
a hand-typed list is a list of what someone remembered that day. All three
registrations were individually sabotaged and each was confirmed to turn the
guard red.

SPEC IMPACT: None.
