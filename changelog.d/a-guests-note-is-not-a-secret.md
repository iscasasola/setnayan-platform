## 2026-08-21 · fix(guests): the guest's own message is no longer hidden in a shut drawer

A guest who replies with a message writes it into `guests.guest_note`. That column
has exactly ONE render app-wide — and it sat inside the collapsed `More details`
disclosure on the host's guest-detail page, which auto-opens on seven
HOST-editable fields and **not on this one**. So a guest whose only contribution
was a message wrote to a host who would never be shown it.

The drawer's summary hint made it worse by naming two things that were not true:
`tags` (the custom-tags input was retired 2026-05-23) and `notes` — which a host
reads as *the guest's* note, when the drawer in fact holds the host's own private
box.

- The read-only "A note from ⟨name⟩" block moves out of `<details>` and into the
  always-visible **RSVP & meal** section, beside the reply it was written with.
- The summary hint now reads `Display name · contact · dietary · tea-ceremony ·
  private note` — every word of which is behind the drawer.
- `hasMoreDetails` is unchanged and is now exactly right: it tests the seven
  host-editable fields the drawer still holds.
- `lib/guest-note-separation.test.ts` gains two guards — the message must render
  OUTSIDE the disclosure, and the summary may not claim `tags` or `notes`. Four
  sabotages, all verified landed by occurrence count, all RED.

SPEC IMPACT: None.
