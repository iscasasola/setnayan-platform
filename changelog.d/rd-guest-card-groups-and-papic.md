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
  same target) — **no new server action** (the budget sits 1 under its 1225 ceiling). The three face switches moved in
  from Photos ("Wants to be tagged in photos" — the guest's own words). Event Papic off → "Papic is off · Turn on ›"
  replaces ONLY the camera choice (owner review, "Always show them": the three consent switches always show and save — they
  also govern the public story / recap and the withdrawal blur); the door goes to the Papic switch (Event Details ›
  papic-answer) and only for those who may turn it on. A check or a camera read that did not answer says so and offers no
  control; "A set number" with no figure says "Enter a number".
- **Guests list**: with guests selected, Set… ▾ gains a Papic group (couple only, while Papic is on) → one sheet
  "Papic · set N each" with the same three choices — sent in batches of ≤50 (the writer refuses more), with an honest
  "X of N set" when a run stops part-way, and the guests that were set redrawn.
- Passed Away posts with the autosave form by `form=` (it sits below Access, whose own forms cannot nest); the autosave
  now hears a field of its form drawn outside it.
- New guard `the-papic-row-is-on-the-card.test.ts`; layout tests re-aimed to the owner's order (each marked RE-AIMED).

SPEC IMPACT: None — implements the approved prototype; the Home Papic widget's "Credits per guest" removal and the Guests
"Setup"→"Settings" rename are other builders' PRs.
