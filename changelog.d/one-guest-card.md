## 2026-09-22 · feat(guests): one guest card — the QR and every field, in one panel that saves itself

Clicking a guest used to open a read-only quick view whose only way into the
edit form was a link called "Open full details" — a page navigation to change
one RSVP. Owner, verbatim: *"can we just open all of these in one pop up
(mobile) and a window opens from the right for desktop? so less clicks easier
access."*

**One body, every frame.** `guest-card-body.tsx` holds the personal QR and all
23 editable columns. `?inspect=<guestId>` server-renders it into a full-height
right column at ≥xl, and `InspectorLayout mobileSheet` presents the same node
below xl as a sheet that slides in from the right and leaves the roster peeking,
dimmed, on the left — tap the strip to go back. Geometry copied from the shipped
payment drawer (`inline-checkout-drawer.tsx`), which is the pattern the owner
named. `/guests/[guestId]` survives as the deep link and renders the same card,
so the two presentations cannot drift; it dropped from 1056 lines to 126.

**It autosaves.** There is no Save button. The card posts the SAME `updateGuest`
action with the same full FormData on a 700ms debounce; `quiet=1` makes the
action revalidate and return instead of redirecting, so the panel stays open and
the caret stays put. Errors still redirect, to `return_to` (pinned to this
event's guest routes). Remove and Take-this-seat-back are never autosaved.

**Arrangement, from the approved prototype** (`Setnayan/prototypes/guest_card_panel_2026-09-22.html`):
QR → Details (name · contact · note) → RSVP (status · invited to · meal ·
dietary) → Seat (table · extra seats · attire) → Party (side · group · role) →
Privacy → Tags → Remove. Twelve sections became eight by merging, not by
deleting: every control survives. Owner corrections applied — the QR sits above
the name, **dietary moved beside meal** (*"these are not contact information"*),
and **Relationship was removed** from the card.

🚨 **`relation` is carried, not edited.** `updateGuest` writes every column it
reads from the form, so removing the Relationship input would have written NULL
to `guests.relation` — on every keystroke, now that saving is automatic. That
column is still written by `/guests/new` and still READ by the tea-ceremony page
to label each elder in serving order. A hidden input carries it through, and
`seniority_rank` got the same treatment on events that do not show it. New guard
`the-card-posts-every-column.test.ts` pins the rule and was mutation-checked
three ways (drop either carrier, drop a field → RED).

**Retired:** the quick-view sheet, its module store and host (`GuestDrawerHost`),
and `GuestDetailBody`. `guest-detail-body.tsx` keeps its path — a guard keys its
QR-strip baseline on it — and now exports just `GuestQrCard`.

**Guards re-anchored, none weakened:** `the-detail-shows-the-face` follows the
face onto the card and now pins both LOADERS (roster + route) including the
linked-account fallback · `the-quick-view-can-act` follows the remove and asserts
something stronger (one body, so one remove path) · `the-quick-view-is-not-on-phones`
was INVERTED to `the-guest-card-reaches-every-width`, because its premise is now
deliberately false. `every-qr-carries-the-strip` passes untouched.

**Baselines regenerated from the merged tree** (`port-control-baseline.json`,
`dup-rule.baseline.txt`). The port-controls diff shows the controls moving from
`[guestId]` to the shared `_components/` card, not disappearing; both files also
pick up unrelated entries because they were last generated at an older ref.

SPEC IMPACT: Prototype + owner rulings recorded in the corpus at
`prototypes/guest_card_panel_2026-09-22.html` (commits b26f61e, 5242988, c652f12).

### CI found three real defects the local run had not

`typecheck + lint` went red and its summary blamed `native encoder tests` — a
step that was *skipped*. The actual failure was **Unit tests**; everything after
it skipped, and the last skipped step got the blame. (Read the step list, not
the summary line.) 13 tests were red. Ten were symbols that had moved file and
were re-anchored. **Three were genuine bugs in this change:**

- **A held identity transform.** `.sn-inspector-sheet` and `.gl-disc` animated
  with `both`, which keeps `transform: none` applied after the animation ends —
  and a held transform makes the element the containing block for every
  `position: fixed` descendant, silently unpinning anything fixed inside the
  card. Both are `backwards` now
  (`an-identity-transform-unpins-every-fixed-child.test.ts`).
- **`aria-modal` without focus management.** The phone sheet promised a modal
  and managed nothing: no focus trap, no restore. It now uses the shared
  `useModalA11y`, like every other overlay (`modal-a11y-adoption.test.ts`).
- **A skeleton promising a heading the page stopped drawing.** Making the route
  a loader removed its `<h1>`, so `[guestId]/loading.tsx` reserved a title that
  never arrived and the screen jumped on land. The card now takes a
  `variant`: `page` draws the `<h1>`, `panel` leaves the name to the column
  header that already prints it, instead of saying it twice.

Guards re-anchored by following the symbol, never by loosening the rule — and
two were re-expressed as the PROPERTY they always meant: the release action is
asserted to sit *outside* the autosave form (it was pinned to `formAction`), and
a side-rendering surface may now ask `eventHasSides()` itself **or** consume the
shared loader's answer, with a vacuity check that the loader still asks.

### Undo for field edits (owner, 2026-09-22: "add the undo for field edits")

A Save button is a moment of consent. Autosave removed it, so a mis-tapped RSVP
segment wrote immediately and silently — while the roster BEHIND the card had
had an undo snackbar for its deletes since the Living Roster shipped. The
destructive path was covered and the ordinary one was not.

Reuses the shipped `pushUndo` / `UndoToastHost`; nothing new was invented. And
because `updateGuest` writes the whole document, undo needs no inverse and no
endpoint: it posts the PREVIOUS FormData back through the same action, so every
column returns to what it was and the one-writer rule holds. The snackbar names
what it is undoing ("RSVP changed", "Meal and Dietary changed").

🔑 **It reaches the screen, not only the row.** Restoring the database while the
inputs still showed the undone value would be this repo's recurring failure:
correct data, lying screen. So the undo puts the controls back — and it cannot
do that by assignment alone. `InvitedToChips` renders CONTROLLED checkboxes, and
a DOM write to one is overwritten by React on its next render with the
component's state never having changed; those are driven with a real `click()`,
which goes through `onChange`. A `restoring` flag stops the change events a
restore fires from re-applying what was just taken back.

`UndoToastHost` is now mounted on the standalone route too — without it an undo
there would restore the row and show the host nothing.

New guard `the-autosave-can-be-taken-back.test.ts`, mutation-checked four ways
(drop the undo call · restore a checkbox by assignment · drop the re-save
suppression · unmount the host) — each RED, baseline restores green.
