## 2026-09-29 · feat(guests): Send invite · Copy message · Send invites one by one — each guest's own link and QR, from the couple's phone

Owner, 2026-09-29: *"maybe we can create a copy text. Hi XXX! Here is our RSVP for our wedding! …"* → each
guest's PERSONAL link so nobody types a name → *"Here is the link: / Here is your QR Code for the event /
Save it to access our website anytime?"* → *"something we can copy and send to them via third party apps like
messenger"*.

- **One message builder** (`lib/guest-invite-message.ts`, extended — it already fed the Invitation page's
  Send modal): the owner's shorter message, event-type aware (`Indalecio & Claire’s wedding` · `Mia’s birthday`
  · `the wake for Lola Nena` in the solemn register), date elided cleanly, "Event Hub" never "website", one-pass
  placeholder fill (a name that says `{link}` or `$&` prints as typed). Shared by the guest card, the run, the
  Invitation page modal, a guest's "Send their invite" to a plus-one (guest voice) and a new group-chat message.
- **Guest card** (phone + desktop): **Send invite** — the phone's share sheet with the message AND the guest's
  QR image where the sheet takes a file, text alone where not, a copy + Download QR + Mark as sent where there
  is no share sheet; a completed share stamps **Sent ✓**. **Copy message** — "Copied ✓", and offers
  **Mark as sent** (a copy is not a send). Undo is one tap.
- **Sent ✓** writes `guests.invitation_sent_at` through the column's ONE writer (`invitation/actions.ts` —
  `writeGuestInvitationSent`, now shared by the Invitation page form and the new `setGuestInvitationSent`).
- **Reword once for everyone**: `events.print_details.invite_message` (the Maker's Details › Words jsonb — no
  new column); placeholders `{name} {event} {date} {link}`; the link is always included; our wording is
  stored as NULL. The Details and Menu saves carry the key over.
- **Send invites one by one** (`/dashboard/[eventId]/guests/send`): "3 of 150", Send to Maria → Next, Skip,
  a done count; who to go through is ONE PickMenu dropdown. Linked from the Invite panel (both doors) and the
  desktop Share menu.
- **Group chat** (Invite panel): "…Tap the link, reply with your full name, and we'll confirm you." — no QR
  promise, per DECISION_LOG 2026-09-26 "NOBODY WITHOUT A KEY GETS INSIDE".
- ⚠ The Invitation page's message no longer names the venue or a ceremonial role (Ninong/Best Man line) — it
  is the owner's shorter message now.

Guards: `lib/guest-invite-message.test.ts` (event types, missing date, escaping, no "website", group message)
and `app/dashboard/[eventId]/guests/send/send-invite-is-honest.test.ts` (the three share paths, the one writer
counting rows, copy-never-stamps, QR fetched before the tap, the wording survives the print saves) —
sabotage-tested.

SPEC IMPACT: DECISION_LOG.md row 2026-09-29 "SEND EACH GUEST THEIR OWN INVITE" (owner quotes + what shipped).
