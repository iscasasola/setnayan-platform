## 2026-10-03 · fix(event-hub): one main action per guest page, one place per control

Owner, on the live guest Event Hub (prod 5666406): *"the places of the different
information is still not fixed. too many buttons. too much going on."* Replace
means remove — nothing new was built; every function is still reachable.

- **Welcome**: the action under the mark is ONE control ("You're going" and a
  "Change" beside it opened the same sheet). The "Save to my account" card left
  (Me holds it). The reply section's own line stands down whenever another door
  opens the sheet. Face-data controls (blur · receipt · remove) moved to Me on a
  tabbed page, beside Face tagging. The day-of "It opens the door…" caption went.
- **Me**: no "Not you? Switch" (it posted to the same sign-out at Me's foot); no
  "You · Your invitation" heading or explainer captions; "Photos of you" only once
  the page itself stops drawing them; "Change your reply" only when the Welcome's
  action is not already that door; the plus-ones' grey caption went.
- **Landing / thank-you** (`/invite/enter`): "Your guests · Send their invite",
  "Copy my link" and the routine "Save to my account" are Me's — one place each.
  Save returns here only to finish a Terms refusal (`?keep=terms`).
- **Everything else**: only rows with no other home (the 3D room, the published
  album). Camera, livestream, Find my table, Print and Share each had a home on
  the page already; greyed date/"After" rows opened nothing. The doorway strip's
  3D card went (the row is its one door). "Find my table" also skipped the key gate.
- **Save the Date film**: the persistent "See our page" / "Add to calendar" chips
  stand down on the closing beat, which has its own full buttons.
- **Post Event**: the phase ribbon (repeated by the footer) went; the footer no
  longer links the story to its own address.
- **Host on their own hub**: the four "Preview" pills are ONE dropdown
  (`OwnerPhaseMenu`, the shared PickMenu); the explaining paragraph under the
  ribbon went; "Your live site" → "Your Event Hub".
- Removed: `guest-account-card.tsx`; YourGuests' thank-you ticket layout; the
  identity fields `invitationUrl` / `accountlessPhotosClosed` (no reader left).
- Guard: `app/[slug]/each-guest-page-has-one-main-action.test.ts` (render + source),
  sabotage-checked (restoring the two-control arrival row turns it RED).

SPEC IMPACT: None
