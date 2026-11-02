## 2026-08-07 · feat(papic): the host can now remove ANY photo — seat photos had no control at all

Owner-locked, verbatim: *"host can delete any photo and that's it."* Guests,
vendors and coordinators deliberately get **no** self-delete.

**RULE 0 first — most of it already shipped.** The host could already hide any
**guest upload**, and that has been true since the Apple 1.2 / Play UGC work.

**The gap was the other kind of photo.** Seat photos — shot on a camera seat by
your paparazzi, and how a vendor or coordinator shoots — had **no host control
whatsoever**, and the host's own moderation screen only listed the ones the NSFW
filter had already flagged. So they could not see them, let alone remove them.

🔑 **THE PLUMBING WAS COMPLETE AND ONLY THE HANDLE WAS MISSING.** `papic_photos`
already has `hidden_at`, and **every reader already honoured it** — the guest
download route, the single-photo route and the couple's own library all filter
on it. The only writer was a Setnayan admin acting on a user report.

**A column every reader respects, with no host-side writer, is a control the
host does not have.** Same shape as the face-vector mode that had zero writers
for seven weeks.

**Shipped:** a seat-photo removal action scoped to the event (so one couple
cannot hide another wedding's photo by id), and a *"Photos from your cameras"*
section on the host's moderation screen listing all of them with Hide / Unhide.

**Reversible on purpose** — the same mechanism as the guest path. The photo
leaves the gallery and every shared link; the file is retained until the
six-month originals sweep, so a mis-click costs nothing.

🛡 **Guard, sabotage-tested.** It pins that a host-facing write exists for
**both** tables, that the seat write targets `papic_photos.hidden_at` and is
event-scoped, and that the screen loads seat photos **unconditionally**.
Re-filtering them to NSFW-only fails with the reason. Comment-stripped, so the
notes explaining this cannot satisfy the guard enforcing it.

🔒 Blast radius today is zero — prod holds 0 photo rows.

SPEC IMPACT: recorded in `DECISION_LOG.md` 2026-08-07.
