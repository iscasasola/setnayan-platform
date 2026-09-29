## 2026-09-29 · feat(guest): no email to guests — the QR and the link do everything

Owner ruling, DECISION_LOG row "NO EMAIL TO GUESTS — THE QR AND THE LINK DO
EVERYTHING" (2026-09-29): *"No email. Either use the qr and link only"*. Copy for
the in-app browser sheet from the approved prototype
`Setnayan/prototypes/guest_ticket_flow_2026-09-29.html` (frame F).

- The RSVP asks for no email and has no "keep this invitation" tick; `submitRsvp`
  reads no `contact_email` and writes no `guests.email` (the couple's stored
  address is untouched). Mobile stays, only when the couple switched it on.
- The keep-link sender is deleted (`sendKeepLinkOnce`, `keepLinkSentFor`,
  `shouldSendKeepLink`, `replyOffersKeep`, the `link_sent` account state and its
  cookie). `claimAccountAction` (which emailed a sign-in link) is replaced by
  `startAccountSaveAction` — Apple / Google by the device, the Terms tick carried
  by the server cookie, never an email.
- Inside Messenger / Facebook / Instagram "Save to my account" is now **Open in
  your browser** (`OpenInBrowser`): one tap copies the guest's own link and a
  sheet says how to paste it into Safari or Chrome. With no provider switched on,
  the button is **Copy my link**. Same on the plus-one's welcome door and the
  Event Hub's account card.
- Guest reminder emails (30 · 7 · 1) are OFF (`GUEST_REMINDER_EMAILS_ON = false`);
  the Maker's "Reminder emails" switch, its piece and its tour are gone.
- Keep / Link on a request no longer email the requester (`issueRequestKey`).
- Emails to couples, hosts and suppliers are unchanged.

Guards updated honestly (each now pins the absence): `guest-one-path.test.ts` § 2,
`guests-are-reminded-30-7-1.test.ts`, `only-the-answer-freezes.test.ts`,
`a-guest-cannot-empty-the-key-back-in.test.ts`, `ask-your-guests.test.ts`,
`the-guest-pathway.test.ts`, `the-arrival-says-what-opens.test.ts`,
`plus-ones-own-link-and-host.test.ts`, `details-words-and-plans.test.ts`,
`the-rsvp-page-follows-the-maker.test.ts`. Port baseline regenerated (the account
card's `OAuthButtonRow` and the save's direct provider forms are replaced by the
one Save).

SPEC IMPACT: None — implements DECISION_LOG 2026-09-29 rows already in the corpus.

## 2026-09-29 · feat(guest): the word is "ticket"

Owner ruling, DECISION_LOG "OWNER ANSWERS — TEN OPEN QUESTIONS" (4): *"Digital
ticket"*. `PASS_CARD_WORDS` flipped — the saved PNG is a **Digital ticket**, the PDF
a **Printed ticket**; guests read "Your ticket" / "Save my ticket" / "Save all
tickets"; the couple "Download ticket (PNG)" / "Download all tickets (.zip)";
files are `<Guest>-ticket-<Couple>-<date>.png` and `<Couple>-<date>-tickets.zip`.
Hand-spelt "pass" copy on the same card moved to the words object (plus-one door,
Your guests, the pass-card routes' refusals) or to "ticket" (day-of "Show your
ticket", the invite message's "your ticket at the door", the Maker scene label
"Guest's ticket", the print piece "Every guest’s ticket"). Guarded in
`the-pass-card-is-a-card.test.ts` (the words, plus no hand-spelt "pass").

SPEC IMPACT: None.

## 2026-09-29 · feat(guest): the thank-you hands over the tickets and the link

DECISION_LOG "TICKETS ON THE THANK-YOU SCREEN" (2026-09-29); layout and copy from
`Setnayan/prototypes/guest_ticket_flow_2026-09-29.html` frames A / A′. After RSVP
the thank-you shows, in order: **Your Digital ticket** (the route's own PNG, small,
with Save — only for an accepted guest who is coming; a guest who can't come gets
the one plain line, a seat with no card keeps the QR panel) · **Your guests** — one
ticket per NAMED plus-one (Save · Send), "+2 · TBA · Add their name" for a blank
seat, and **Save all tickets** naming the files it saves · **Copy my link** (their
own link; "Copied ✓") · **Save to my account** ("… your name, mobile, meal and your
guests come along") · Not now. New `TicketRow`; `YourGuests` gains `ticketRows`.
Guarded by `app/[slug]/invite/the-thank-you-hands-over-the-tickets.test.ts`
(sabotage-tested). Also fixes two stale expectations in
`the-guest-pathway-me-and-checklist.test.ts` (the removed `hasEmail` prop; "ticket").

SPEC IMPACT: None.
