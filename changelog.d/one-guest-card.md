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
