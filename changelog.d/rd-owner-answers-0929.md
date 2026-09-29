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
