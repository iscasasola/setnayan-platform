## 2026-09-27 · fix(rsvp-page): one question at a time everywhere, no boxes, the Maker canvas follows every switch

The owner, on Maker → RSVP: *"you said one question per screen. this is not one
question per screen."* · *"didn't we get passed the no boxes concept already?"* ·
*"the slides showing doesn't seem to follow the what to add."*

- **One question at a time, on every reply card.** The Event Hub's reply sheet
  now reads the same `rsvp_ask_config.oneAtATime` as the RSVP page (it never
  passed it). Every question is its own step — the photo, meal and dietary
  (now two steps), who you bring, the song, the note, the contact details, and
  the last step holding Terms/keep + Save. The step walker skips a step whose
  parent the card hides (a decliner is never walked through the meal).
- **No boxes.** Gone: the reply card's deckle/shadow, the ticket's card, the
  pass's card (its coloured header band and tear line — the QR tile stays),
  the "Need to change your reply?" box, the declined box, the flash boxes, the
  scan-trail and face-data notice boxes, the details fold's border. The three
  answers are pills on the ground.
- **The canvas follows every draft switch, and opens on the questions.** Maker
  → RSVP now shows "The questions" by default — the key-holder's RSVP page for a
  SAMPLE guest who has not replied (host-verified `?editor=1`, wearing the
  draft; every switched-on question shown at once) — with the shared two-way
  switch ("The questions" · "After they reply", the Love Story switch, now
  `MakerPageSwitch` in `maker-page.tsx`). Send in the preview writes nothing.
  The RSVP page header is the invitation's (names · date · place), then whose
  reply it is.
- **The "Song request" switch asks a song** on the RSVP (its own step), saved
  through the existing `guest_submit_song_request` door after the song route's
  moderation — best-effort, never costing the reply. +0 server actions.
- **No "we couldn't check" in the preview.** The scan-trail notice is skipped in
  the Maker canvas and for the sample guest (whose id is not a uuid, so its read
  failed — 22P02). Real guests' reads were fine (134 of 134 rows readable).
- **The one-at-a-time switch** re-seeds from the draft whenever it changes and
  carries `aria-checked`, so label, knob and value are one value.

- **The preview wears this event's own guest** (owner 2026-09-27: *"each
  editor of each event will adapt to their event"*): the first guest on the
  list who is not the couple — preferring one with a plus-one — by NAME and
  PLUS-ONE ALLOWANCE only, read only, keeping the sample's id so nothing is
  ever written for them; "Your guest" when the list is empty. (cale-ice: Antonio
  Loo, +1.)
- **The event poster QR opens the event** (owner 2026-09-27: *"sign in to enter
  or upload your qr to login"*): the stranger's door is now Upload your QR
  (decoded in the browser with the repo's `jsqr`, never uploaded; only THIS
  event's invitation goes to its key, anything else gets "That code isn't an
  invitation to this event.") and Sign in. "Ask to join" appears only when the
  couple chose "Anyone, I approve"; the branded poster door `/{slug}/invite`
  sends everyone to the event page on an "Only my Guest List" event.

SPEC IMPACT: None — follows the owner's 2026-09-27 rulings as given.
