## 2026-09-27 · feat(guest-pathway): the key gate, the RSVP page, the thank-you Save, and the stranger's one door

The guest side of the guest pathway (owner 2026-09-26/27 — DECISION_LOG "GUEST
PATHWAY", "GET INSIDE", "NOBODY WITHOUT A KEY", "TWO LEVELS OF ACCESS", "THE
RSVP IS ONE EDITABLE SCENE + ONE SWITCH"; build brief
`build-sessions/GUEST-PATHWAY-BUILD-BRIEF-2026-09-26.md`). One button per
screen; we choose the method for the guest.

- **Key gate.** A guest holding their key (link = QR = NFC, or a signed-in seat)
  with a missing required answer is redirected, on the server, to the RSVP page
  (`/{slug}/invite/reply`) before anything renders. One pure rule,
  `rsvpGate` (`lib/guest-one-path.ts`), asked by the event page and the RSVP
  page alike: the answer (always), meal and mobile when switched on. A guest the
  couple already marked attending sees "The couple has you down as attending ✓"
  and only what is missing, plus "Not coming after all?"; a question switched on
  later is asked alone. After the final-count lock the gate never closes — an
  unreplied guest is inside, marked "Didn't reply · you're in".
- **RSVP page.** One button, Send. The Terms tick (unticked, required) sits on
  the Send step; `submitInviteReply` refuses an unticked Send, carries the
  agreement in an httpOnly cookie, and no longer emails a sign-in link on Send.
  The "only what is missing" card carries every unasked answer through as
  stored, so nothing is erased. "Ask one question at a time" reads
  `rsvp_ask_config.oneAtATime` (one question per screen, progress, Back; the
  full page without script). "Not you? Switch" clears the guest pass. The
  Google/Apple row left this page.
- **Thank-you.** "See you on the 18th, Ana!" · "Your guests" (one "Send their
  invite" per named plus-one — the phone's share sheet with THAT person's own
  link; "Add their name" for a TBA seat) · ONE "Save to my account", method
  chosen by the device (Messenger/Instagram/Facebook webview → the emailed link;
  iPhone → Apple; Android/desktop → Google) · small "Not now". The OAuth
  callback now records `terms_accepted_at` + `terms_version` for a Google/Apple
  account made from "Save to my account" when the guest ticked Terms on the RSVP
  page — the gap `terms-agreement.ts` named.
- **The stranger.** General details and ONE button, "Get inside: Scan your QR ·
  Tap NFC · Sign in"; a signed-in account not on the list sees "You're not on the
  guest list for this event yet" + "Ask to join" (`/join/{eventId}`). The live
  photo wall, the event-day camera/photos bar and the seat finder are no longer
  rendered for a viewer without a key. Stranger bar: Home · Details · Story; the
  Invitation bar for a guest: Home · Details · RSVP · Story · Me. The day-of
  schedule shows without a key on the day too.
- **"Two ways to celebrate"** leaves the Invitation and On the Day stages
  (replaced by the Save step); Post Event and the Maker canvas keep it.

+0 server-action exports. No migration.

SPEC IMPACT: None — builds the owner's 2026-09-26/27 DECISION_LOG rows as
written; no new decision. Open items are listed in the PR body.
