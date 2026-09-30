## 2026-09-30 · feat(guests): the Fable guest card and Guest list rows

Builds the three approved designs — `prototypes/guest_card_invite_simple_2026-09-30_fable.html`, `guest_card_details_2026-09-30_fable.html`, `guest_list_rows_2026-09-30_fable.html` (DECISION_LOG 2026-09-30 "APPROVED — THE FABLE DESIGNS FOR THE GUEST CARD, THE GUEST LIST ROWS AND THE GUEST LANDING PAGE" and "WALKING TOGETHER IS NOT BEING A COUPLE").

**The guest card**
- Top: their real Digital ticket, small — tap → the full ticket with ONE **Save ticket** (replaces Download ticket and Download QR). Right of it: ONE **Invite** (phone: the share sheet with message + link + ticket; computer: 1 Copy message · 2 Copy ticket · 3 Mark as sent, each ticking green), a **⋯** (Write to NFC · New QR · Unlink account — one list; New QR and Unlink each ask first), and the status line (`Not sent · Not linked` / `✓ Sent Sep 30 · Linked`). The QR image, "Customize guest QRs", "All guest QRs", Copy message and "Change the message" left the card (the QR's look is the event's — Maker › Details › Look; the wording is changed on "Send invites one by one").
- **New QR** rides `releaseGuestClaim`'s door (`new_qr=1`): rotates the key through `rotate_guest_qr_token` ONLY (the guest stays linked), then sets the status back to Not sent through the column's one writer.
- Name open and writable: Prefix (dropdown, `prefixChoicesFor`) · First · Middle · Last · Suffix · Shown as.
- Then seven rows, closed with a one-line summary, one open at a time (a native exclusive `details` accordion): Details · RSVP · Seat · Photos · Private note · Access · Tags (read-only). Yes/No = switches; one choice = one `PickMenu`; several = a `PickMenu` with checkmarks (new `picked` mode) — **Also serves as** and **Groups** editable on the card; **Table** a dropdown in place (moving them moves them on the seat plan).
- RSVP: Attending · No reply · Not coming (Maybe listed only for a guest who already said it).
- ✉ No email is shown anywhere; the address is carried hidden so autosave never erases it. The one email left is the bride/groom row's own sign-in link (the only way a partner's couple seat can be claimed — `sentByCouple`), in Access — **flagged for the owner below**.
- No "walks with" on the card or the rows.
- `updateGuest` now also writes extra roles, group memberships and the table — each ONLY when the card posted its `*_posted` marker, the table only when it changed (so autosave never resets a chair).

**The Guest list rows**
- Desktop columns: ☐ · Name · Side·Role · Group · RSVP · +N · Table · Account · Invite (Invite · ⋯ + status). The Contact column (call / email icons), the eye and the 2px side edge left (side is a word now). Click anywhere on a row opens the card.
- Phone row: face, name, one line (role · groups · +N · Table — each still editable in place), the reply pill; under a dashed line, Invite · ⋯ and the status. Bride and groom rows say Host.
- The reply pill opens ONE dropdown — the tap-to-cycle is gone.
- A named +1 sits indented right under the guest who brings them, on every sort and grouping (`lib/plus-ones-under-bringers.ts`).
- Long-press a phone row to start selecting; ONE bulk bar on every width: N selected · M not yet invited · Select all · Clear/Done, then Invite selected (the one-by-one run with only the ticked guests, `?ids=`) · Set group ▾ (+ New group…) · Set table ▾ · ⋯ (Set side · Set role · Mark invited · Remove). Set table rides `bulkApplyRoleAndGroup` (`table=`). No name chips; no Pair.
- Head: Sort ▾ (the only place for order — the header's group-by ticks and sort arrows are gone) and four dropdowns RSVP · Side · Role · Group (tags at the bottom of Group; "Make or rename groups…" opens the group manager). An active dropdown says its value in gild; the chip strip left.
- Counts line: guests · attending · not coming · no reply · **to invite** · **requests** (the last two in wine; "N of M shown" under a filter); never drawn on a refused read.
- Requests are never rows between guests: one strip under the title → the Requests page.
- "Invite" that shared the one event link is now **Share the link**. "Nobody matches" builds its sentence from the filters; the truly empty list reads "No guests yet — Start with the two of you…" with + Add a guest · Paste a list.

**Guards**
- New: `the-fable-card-and-rows.test.ts` (14 rules; each sabotaged once and seen RED).
- Re-pointed to the approved design (their protective rule kept): the QR strip, the drawer QR (now the ticket), the QR-download sweep, passed-away, face helper, walking pair (now: never on the list), unpair, honest reads, Rule 1 contact bill (now empty), +N picker, role words, unlink, the Invite step, the pass card, gold bill, swipe gate, shell-bar sticky, one breakpoint, select-all, compact row, phone parity, one colour per row, header widths (px budget 144 → 208 for the ⋯, % 55 → 50 for Name), roster lines up (caught a real bug: a section row spanning 10 of 9 columns).
- Deleted with their last callers: `guest-detail-body.tsx`, `guest-save-links.tsx`, `guest-pass-card-link.tsx`, `guest-drawer.tsx`, `GuestSendInvite`.

**Budgets (measured, `next build` on this branch with main through #6184 merged):** shared bundle **206,831 B** of 206,848 (main 206,833 → −2 B); Event Hub Maker first load **503.0KB** of 505KB; server actions **1225** (+0 — Set table rides `bulkApplyRoleAndGroup`, New QR rides `releaseGuestClaim`). The Maker's parent cards (Details › The Invitation) get a plain server-drawn ticket and no ⋯ — the card takes the ticket view and the ⋯ as props the Guest list hands in. A `next/dynamic` split was tried first and measured +58 B on the every-page webpack runtime, over the shared ceiling, so it was not used. Port-controls baseline regenerated (the moved controls are the diff).

⚠ **For the owner:** the bride/groom row keeps one email — "Send {name} their sign-in link" — because a couple seat refuses every other link; removing it would leave a partner no way to claim their own row. Say the word and it goes.

SPEC IMPACT: None — builds approved designs already recorded in DECISION_LOG (2026-09-30).
