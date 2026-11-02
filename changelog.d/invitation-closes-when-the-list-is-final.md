## 2026-08-20 · fix(event-hub): the invitation closes when the guest list is final

Owner, 2026-08-20: *"let us fix the invitation part of the event hub. this part
will only show while the guest list is not yet finalized."*

**RULE 0 — none of the finalizing is new.** `events.guest_list_edit_deadline` +
`guest_count_locked_at` ship, `ensureFinalized` (`lib/pax.ts`) stamps the lock
lazily, `guard_guest_edits_when_locked` refuses count changes, and the couple's
roster already says *"Guest list finalized"*. What was missing is that the Event
Hub never asked. Nothing was redrawn.

* **The ask closes; the answer does not.** `rsvpAskOpen` (new) gates the RSVP
  form and the quiet *"need to change your reply?"* drawer. `rsvpShouldRender`
  is deliberately UNCHANGED — it gates the whole section, which is also where a
  guest who already replied finds their keepsake ticket and their seat, and the
  list finalizes ~2 weeks out. Closing the section would delete that ticket in
  the fortnight it matters most. A golden test asserts the section survives.
* **A closed line, not a hole.** `RsvpClosedNote` stands where the form was. The
  RSVP is the page's one form the editor may not hide; a guest who finds NOTHING
  there reads a broken invitation, not a closed one.
* **The door, not just the form.** `submitRsvp` now refuses a late reply itself.
  🔑 The database will NOT catch it: `guard_guest_edits_when_locked`'s own header
  names *"the guest self-RSVP portal"* as a path it covers, but its first branch
  exempts `service_role` — and that action writes with the ADMIN client. The one
  guest-facing path the guard was written for is the one it cannot fire on.
* **The refusal is visible.** `?rsvp=closed` had nowhere to land: the flash has
  always been drawn by `RsvpWidget`, the component that is gone by then. The
  closed note renders it.
* **One arithmetic, two callers.** `lib/guest-list-closed.ts` (pure) now owns the
  deadline math; `ensureFinalized` calls in rather than keeping its private copy.
  The hub reads the DEADLINE, never the lazy stamp — the stamp is written when
  somebody on the couple's side happens to open a page, so a stamp-only read
  keeps taking replies for days and stops at a moment nobody chose.
* **No more nudging.** The guest card's *"Please confirm you're coming"* becomes
  *"Replies are closed."*

Tests: 7 pure (incl. a 4-timezone instant check) · 3 plan goldens · 10
render+wiring. All mutation-checked by occurrence count.

SPEC IMPACT: None — this implements owner decision ⑥ of Adaptive Pax Pricing
(`DECISION_LOG.md` 2026-06-13, "auto-FINALIZES at the guest-list edit deadline")
on the guest-facing surface. A `DECISION_LOG.md` row is appended separately.
