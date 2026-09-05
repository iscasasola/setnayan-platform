## 2026-09-06 · fix(guests): the quick view can act, not only show

Every other place a host meets a guest can remove them — the desktop bulk bar
(optimistic + undo), both phone densities (swipe-left), and the `[guestId]`
page's "Remove guest". The QUICK VIEW could not. One body behind two frames
(the below-xl sheet and the desktop inspector column), it let a host open a
guest, read their contact, groups, RSVP, seat and QR, and then offered exactly
one exit: "Open full details" — leaving the roster they were working in to do
the one thing the panel exists to save them a trip for.

Read-only is a legitimate design for a PREVIEW, and the file's docblock called
it that. It stopped being one once the roster row beside it grew inline editors
for side, role, RSVP and groups: every field on the row became actionable while
the panel showing those same fields in detail stayed inert. The panel was not
more careful than the row — it was older.

It now posts the SAME `softDeleteGuest` the full detail page posts. That action
owns both gates (the couple is refused; a guest who has already RSVP'd must be
reset to Pending first), so nothing is re-spelled here — a test asserts the RSVP
gate is NOT copied into the UI. The one thing mirrored is the couple case, and
only because a button that can only ever fail is worse than no button: the
couple gets the same sentence the detail page shows.

⚠ Accepted, not hidden: a refusal redirects to `[guestId]?error=…`, so removing
an RSVP'd guest from the sheet bounces to their full page carrying the reason.
That is `softDeleteGuest`'s existing behaviour, shared with the detail page.
Forking a nicer in-sheet error would mean a second copy of the failure path,
which is the thing this change exists to avoid.

Guarded by
`apps/web/app/dashboard/[eventId]/guests/_components/the-quick-view-can-act.test.ts`
(4 tests; three mutations measured RED; suite 54/54; route-scoped `tsc` exit 0;
`lint-server-only-boundary` clean — the action import does not cross the
client/server boundary).

SPEC IMPACT: None. Adds a door to an existing action; no gate changes.
