## 2026-08-24 · fix(guest): a guest is on the list, and can reach their own details

W2-A items 4 and 5. Both turned out **smaller than the brief** and one of them
turned out to be **two surfaces, not one** — Rule 0 found both before any code.

### Item 4 — the one status word said "you have not finished"

A guest who joins **is** on the list: the row exists, the seat is theirs, and
`rsvp_status` is `NOT NULL DEFAULT 'pending'`, set at row creation rather than by
anything the guest failed to do. But the only status-shaped element on the page
they land on read **"PENDING"** in muted grey mono uppercase.

⚠ **THE BRIEF'S FIRST CLAUSE — "nobody who joins is told they are on the list" —
IS FALSE.** Five shipped surfaces already say it, including the always-on
greeting a host cannot hide. So this was never a missing mechanism; it was one
word contradicting five others. Now **"No reply yet"** — about the *answer*,
which is the thing actually outstanding.

🔑 **AND IT WAS TWO SURFACES WITH NO SHARED CONSTANT.** `RsvpPill` said
`'Pending'`; `guest-hub-card`'s `rsvpMeta` default arm said `'RSVP pending'`.
Same guest, same page, two resolvers, already drifted — agreeing only by
coincidence. Both now say the same words and a test fails if they diverge again.

⚖ **NOT TOUCHED, because each is a decision rather than a defect:** "Your place
is reserved" (owner-locked, `DECISION_LOG` 2026-06-14 *RSVP path purpose
LOCKED* — read before changing any word here), the tone map, the chip classes,
the radio labels, and the enum value itself. A test asserts the locked line
survives and that `pending` is still the state the code branches on, so a copy
fix cannot quietly become a data change.

### Item 5 — nothing pointed a guest at their own contact boxes

The reply card holds the guest's email, mobile and preferred name, renders inline
on the page they are already on, and nothing linked to it. For a guest who has
answered it is folded behind a disclosure labelled only *"Need to change your
reply?"* — so someone wanting to fix a phone number had no reason to open it.
That is the same failure the widget's own #4683 note cites four lines from the
boxes.

Now: an anchor, one **"Your details"** chip on the existing Quick-links row, and
a label that names both things behind it.

🔑 **THE PHASE GATE IS THE PART A NAIVE FIX GETS WRONG.** The reply card is gated
to the `rsvp` phase, while the summary card carrying the chip renders in all
four. An ungated chip would scroll a guest to nothing in three phases out of
four. The chip is gated on the same `plan.rsvpShouldRender` that decides the
card, and the anchor sits INSIDE that gate.

⚠ **THE ANCHOR COULD NOT GO WHERE IT OBVIOUSLY BELONGS.**
`only-the-answer-freezes.test.ts` pins each `<RsvpWidget` mount's immediate
predecessor to one of exactly two strings and calls itself deliberately brittle.
Adding `id=` to the `<div className="mt-4">` above a mount, or wrapping either
mount, breaks it. The anchor is a zero-height sibling instead — **that guard is
untouched and still passes**, and the new test restates its rule at the place it
is easiest to break.

🛡 **12 mutations across the two items, every one measured, all red.**

🪤 **AND FOUR OF THEM REPORTED A FALSE PASS BEFORE I NOTICED.** My mutation
harness was a copy whose test glob still pointed at the *previous* item's file,
so it faithfully sabotaged item 5 and then ran item 4's suite. Four
implausible greens in a row is what gave it away, not the harness. It now prints
`# tests N` and treats a zero-test run as its own outcome, because
`# tests 0 · # fail 0` is indistinguishable from a pass at a glance — the
bracket-glob trap this repo already documents, reached by a different road.

✅ typecheck clean · lint exit 0 · **test:unit 9688/9688**.

SPEC IMPACT: closes items 4 and 5 of
`WHATS_NEXT_Guest_Activation_2026-08-22.md` § SECTION 2.
