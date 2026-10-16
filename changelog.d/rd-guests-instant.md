## 2026-10-16 · perf(guests): the Guest list opens from the phone's last copy; lean rows; Download as Excel; the ticket is fetched once per version

Owner, 16 Oct: *"wouldnt it be better for someone to just have a excel file for their guests that loads fast
instead of always waiting for that 2.5 sec load everytime?"* · *"We want us to be a practical reason to use."*
· on the guest card's ticket: *"Why is there a 2-6second gap to see the digital pass of a person"* ·
*"And it always reloads i thought we have cache."*

- **Opens from the phone.** The Guests loading screen used to paint an INERT html picture of the last list
  (#6288's last-seen mechanism) until the server answered. It now draws the host's last COPY of the rows with
  the real `GuestsScreen` — scroll, fold, search work at once — under "Showing your last copy · updating…",
  and the fresh list replaces it ("Updated just now"). Same store, same keys (account + event + page), same
  sign-out wipe and one-account rule, a data entry instead of html (`saveLastSeenData` / `readLastSeenData`).
  The copy holds only what a row shows — never mobile, email, the couple's notes, the diet or the QR token —
  compact (~0.36 KB a guest). Nothing on a copy writes (no Select, Remove, Add).
- **Honest when the refresh fails.** No fresh list after 15 s, offline, or a REFUSED guest read → the copy
  stays, dimmed, under "Couldn't update — showing your last copy from <when>. It may be out of date." + Try
  again. Never "No guests", never fresh. A refused read is never kept.
- **Lean rows.** The page sends the list `toGuestListRow` objects — the 26 fields it draws and searches, not
  the 44-column row (`lib/guest-list-rows.ts`). The card still reads its own row on open.
- **Download as Excel**, one tap on the replied line: `GET /dashboard/[eventId]/guests/export` — a CSV in the
  import template's own columns (+ RSVP, Table), UTF-8 BOM (ñ correct), CRLF, no cell runs as a formula
  (PH mobiles written "0917 123 4567"; others get an apostrophe the importer strips). Uploaded again unchanged,
  every row reads "already on the list". 503, never an empty file, on a refused read; `private, no-store`.
- **The ticket once per version.** `/api/guest/pass-card` answered `private, no-cache` and loaded the whole
  print kit before every 304; on a share-capable phone the card asked twice. The card now gets the ticket's
  version (`passCardTicketVersion`, streamed — the card never waits) and asks at `?guest=…&v=…`, which the
  route answers `private, max-age=31536000, immutable` only when `v` is the current version. The version now
  covers every picture (the couple's photo, not only the mark). Thumb, full view, Save and Share use one
  address.

Guards: `guests/the-guest-list-opens-from-the-phone.test.ts` (repeat-open budget) ·
`guests/a-kept-guest-list-is-one-persons.test.ts` (isolation per account/event, sign-out wipe) ·
`guests/a-failed-refresh-shows-the-last-copy-as-old.test.ts` (failure-not-fresh) ·
`guests/the-list-sends-only-what-it-draws.test.ts` (lean rows, executed) · `lib/guest-export-file.test.ts` ·
`lib/the-ticket-is-fetched-once-per-version.test.ts`. Each sabotaged once.

SPEC IMPACT: the last-seen mark's words change for all five pages ("Showing your last copy · updating…",
"Couldn't update — showing your last copy from <when>…") and the Guest list keeps rows rather than a picture
— a refinement of DECISION_LOG 2026-10-02 "LAST-SEEN DATA SHOWS INSTANTLY, THEN REFRESHES"; flagged for the
controller to record, not written to the corpus from this builder.
