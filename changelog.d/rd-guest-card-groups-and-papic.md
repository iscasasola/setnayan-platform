## 2026-10-23 · feat(guests): the guest card in the owner's groups, and Papic one guest at a time

Owner-approved design `Setnayan-specs/prototypes/guest_card_groups_and_papic_2026-10-23.html` (commit c17e5a68).

- **The card, regrouped in the owner's order** (`guest-card-body.tsx`) — one row per group (label · one-line summary · open),
  a divider between them, no box around any: 1 Profile · QR · **Basic Info** (the name + mobile, CLOSED, the mobile in its
  summary) · 2 Details · 3 **Additional Guests** (extra seats + one line per +1, out of RSVP) · 4 **RSVP Status** (reply,
  invited to, meal + dietary, and the guest's own note — the group opens by itself when there is one) · 5 **Papic** (new) ·
  6 Seat Plan · 7 Note for them · Private note (one group) · 8 Access · 9 **Passed Away** (out of Details) · 10 **Delete**
  (out of the ⋯). Every control kept a home; the card posts the very same form (the golden is unchanged). The read-only
  **Tags** line is removed (its words were the eyebrow and the summaries).
- **Papic per guest** — "Their camera ▾": Shares with everyone (default, no row) · A set number (credits) · No camera (0),
  backed by the SHIPPED ceiling (`papic_set_guest_spend_ceiling`, `papic_guest_spend_ceilings`) through the shipped
  `setGuestAllotment`, which now also answers in place (`quiet=1`) and takes several `guest_id` (one RPC per guest, the
  same target, at most 50 guests per call — `ALLOTMENT_BATCH_MAX`) — **no new server action** (the budget sits 1 under
  its 1225 ceiling). The three face switches moved in from Photos and ALWAYS show and save (owner 2026-10-23, "Always
  show them": they also drive the public story/recap and the withdrawal blur, and `updateGuest` is the only writer of
  `photo_consent = false`), worded for the guest ("Wants to be tagged in photos", "Wants their face blurred on the Live
  Wall", "Stays out of face recognition"). Event Papic off replaces ONLY "Their camera" with "Papic is off · Turn on ›",
  whose door lands on the switch (the Event Details answer when the host said No, else the Papic page) and is drawn only
  for the couple. "A set number" with no figure kept says "Enter a number". A check or a camera read that did not answer
  says so and offers no control.
- **Guests list**: with guests selected, Set… ▾ gains a Papic group (couple only, while Papic is on) → one sheet
  "Papic · set N each" with the same three choices, sent in chunks of 50 with an honest "X of N set" on a partial save.
- Passed Away posts with the autosave form by `form=` (it sits below Access, whose own forms cannot nest); the autosave
  now hears a field of its form drawn outside it.
- New guard `the-papic-row-is-on-the-card.test.ts`; layout tests re-aimed to the owner's order (each marked RE-AIMED).

SPEC IMPACT: None — implements the approved prototype; the Home Papic widget's "Credits per guest" removal and the Guests
"Setup"→"Settings" rename are other builders' PRs.
