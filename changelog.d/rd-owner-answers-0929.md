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

## 2026-09-29 · feat(guest): a requester gets their own key at once — it unlocks when the couple accepts

DECISION_LOG "A REQUESTER GETS THEIR QR AT ONCE; IT UNLOCKS ONLY WHEN THE COUPLE
ACCEPTS" + "IT IS THEIR DIGITAL TICKET, IN A 'REQUEST PENDING' STATE" (2026-09-29);
screens and copy from `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`
frames B–E, G1–G2, H1–H3. One pure decision, `requestKeyState` / `doorVerdict`
(lib/request-key.ts), asked live by every door:

- **On Send** the request row's own key is remembered in this browser's own
  cookie (`sn_request_key` — never a guest session) and the requester lands on
  `/{slug}/request?sent=1`: "Sent to the couple", their **Digital ticket** with a
  dashed "Request pending" band and "Not valid at the door yet"
  (`/api/guest/request-ticket`, Classic card, same file name), Save, Copy my link.
  The request form asks for no email and needs no contact.
- **Reopening / scanning while pending** → "Waiting for the couple to confirm you"
  (nothing private). **Accepted** → the same key opens their invitation and the
  thank-you says "You’re in!" with "Save your Digital ticket". **Linked** → the
  key forwards to the guest they were joined to (Link now leaves
  `linked_into:<id>` on the removed request). **Declined** → "Sorry, your request
  was not approved."
- **The door checks live** (`checkTicketLive`): green "Valid ticket" (a guest
  accepted after the desk loaded included), amber "Not confirmed yet" (→ Open in
  Guest List → Pending), red "Not approved", each stamped "Checked live at … · N of
  M arrived"; `checkInGuest` itself refuses a request. "Check in" reads "Mark arrived".
- **Requests page**: Accept · Decline · Link; right after Accept the row shows
  "Accepted · just now" with **Send invite · Copy message** (the shared builder)
  and Undo; after Decline, what their QR will say, with Undo (2 minutes).

Guarded by `lib/request-key.test.ts` (sabotage-tested five ways); updated
`lib/guest-requests.test.ts`, `the-thank-you-hands-over-the-tickets.test.ts`.

SPEC IMPACT: None.

## 2026-09-29 · feat(guest): "No thanks" after a selfie deletes it — with one confirm

OWNER ANSWERS (3). A guest with a selfie who picks "No thanks" is asked once
(`SelfieNoThanksConfirm`); confirmed, `submitRsvp` runs the SAME erasure as
"Delete my face data" — now one helper, `eraseGuestFaceData` (vector nulled,
enrollment tombstoned, own R2 selfie deleted, auto-face tags pulled, every story
copy made stale). Unconfirmed, nothing changes. Guarded by
`app/[slug]/_lib/no-thanks-deletes-the-selfie.test.ts`.

SPEC IMPACT: None.

## 2026-09-29 · feat(prints): Printed ticket batches drop who can't come

OWNER ANSWERS (9). `loadGuestPasses(…, { ticketsOnly: true })` for the Printed
ticket batch applies the Digital ticket's own rule (`filterPassCardRows`): a
decline, a declining bringer's plus-one and a "+ TBA" seat drop; the free QR sheet
keeps everyone. Guarded by `lib/printed-tickets-drop-who-cannot-come.test.ts`.

SPEC IMPACT: None.

## 2026-09-29 · feat(guest): a plus-one who linked their own account keeps their name

OWNER ANSWERS (10). The reply (`lockLinkedSeatNames`) and the host's guest card
(`updateGuest`) no longer write a linked plus-one's name; both show it read-only,
"Linked to their account". Guarded by `lib/a-linked-plus-one-keeps-their-name.test.ts`.

SPEC IMPACT: None.

## 2026-09-29 · feat(prints): "Changed since you printed"

OWNER ANSWERS (5). There was no printed-at stamp; what it reuses is
`printInputsVersion` (the hash the Maker's previews carry as `v`): print PDFs now
answer with `X-Print-Version`, the Save button keeps `{version, at}` per piece in
this browser (lib/printed-stamp.ts), and the piece / whole set / tickets panel
says "Changed since you printed on 29 Sep — save it again so the paper matches"
once the inputs move on. Lazy in the existing `maker-details` chunk. Guarded by
`lib/changed-since-you-printed.test.ts`.

SPEC IMPACT: None.

## 2026-09-29 · feat(maker): a wake's rounds are its own

OWNER ANSWERS (6). `guidedRoundsFor` (read off EventWords' `solemn`): a wake's
rounds are "Share the news · Service details · The day"; christening, debut,
birthday and weddings keep "Save the Date · Invitations · The day". The plan
carries `roundWords`; the guide and its top menu read it. Guarded in
`lib/details-guided-flow.test.ts` (8).

SPEC IMPACT: None.

## 2026-09-29 · feat(maker): each theme's background has a name you can picture

OWNER ANSWERS (11). `THEME_BACKGROUND_NAMES` — Rustic sunset table · Modern
gallery walls · Cinderella moonlit frost · Luxe chandeliers · Vintage capiz light
· Whimsical lantern meadow · Regency ballroom · Gatsby champagne deco · Cyber neon
street (Classic: none — plain paper). Shown as Main background's first choice.
Guarded in `lib/the-main-background-offers-every-choice.test.ts`.

SPEC IMPACT: None — names drawn from each theme's own blurb; the owner may rename.

## 2026-09-29 · feat(prints): the A3 Our Story poster can take your own photo

OWNER ANSWERS (1). One PickMenu on the poster piece — "The theme’s picture" (the
default) or "My photo" (uploaded right there, not squeezed in the browser). The
server keeps only the couple's own upload for this event, measures it, and the
panel warns under A3 at 150 dpi (1754 × 2480). Drawn full-bleed under a paper veil
(`posterGround`). Offered only where there is a Love Story. Guarded by
`lib/the-poster-takes-your-photo.test.ts`.

SPEC IMPACT: None.

## 2026-09-29 · feat(maker): "Both" inside the Hero and Reveal pieces

OWNER ANSWERS (8). View ▾ Both draws the Hero and Reveal pieces as desktop + phone
side by side (it collapsed to Desktop). The Love Story piece is its in-place book
editor, not a page frame. Guarded by `lib/both-view-in-details-pieces.test.ts`.

SPEC IMPACT: None.
