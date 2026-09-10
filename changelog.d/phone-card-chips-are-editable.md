## 2026-09-05 · fix(guests): the phone roster card edits what the desktop row edits

`DesktopRow` and `GuestCard` render the same four chips from the same atoms —
side, role, RSVP, groups. On the desktop row all four open a picker. On the
phone card, `<SidePill>` and `<RoleChips>` were rendered raw: identical pixels,
no trigger, nothing on tap, for every guest rather than only the couple.

It did not feel broken, which is why it outlived the P4 mobile-parity pass that
added the RSVP cycle and the seat chip right beside it. The card's content sits
under `pointer-events-none` so taps fall through to the stretched detail link —
so tapping a raw chip OPENS THE GUEST. It reads as "this chip isn't a control",
not as "this control is missing".

`GroupChipList` was the one that did more than refuse an edit. The card mounted
it, and it ships a remove-from-group form; the matching `AddToGroupControl` was
never added. A phone could take a guest OUT of a group with no way to put them
back — an association destroyed from the only screen a phone host has.

`GuestCard` now wraps its side and role pills in the existing `SideChipEditor`
and `RoleChipEditor` and mounts `AddToGroupControl` beside its group chips;
`groups` and `bulkRoleSections` are threaded down through `MobileGridItem` so
the phone offers the SAME role sections as the bulk bar rather than a
phone-only second list. No new editors, no forked gates: `RoleChipEditor` keeps
sole ownership of the bride/groom lock, and a test asserts `GuestCard` does not
re-spell that condition. Guarded by
`apps/web/app/dashboard/[eventId]/guests/_components/the-phone-card-edits-what-the-desktop-row-edits.test.ts`
(6 tests; four mutations measured RED; route-scoped `tsc` clean).

The compact list density (`?density=list`) still shows no side/role/group chip
at all — that row is avatar / name / RSVP / seat by design, and adding chips to
it is a layout decision left to the owner, not folded in here.

SPEC IMPACT: None. Restores parity with the desktop row's shipped behaviour; no
locked decision named which viewport carries the inline editors.
