## 2026-08-19 · fix(identity): your face, not a letter

Two surfaces painted a stand-in for the signed-in person where their own photo
belongs, found by a four-angle sweep for every such circle in the app.

**The home composer.** The "What's your event?" row led with a gold circle
holding the first letter of your name — on a page whose top bar was already
showing your actual photo. Two different faces for the same person, inches
apart. The page already read the user's row, so this widens that read by one
column and resolves it; no new query.

**The call room.** It derived its monogram by slicing character zero off
whatever string it was handed, and every string but one was a STATUS. Turning
your own camera off drew a circle reading "C" ("Camera off"); waiting for your
supplier drew "W"; your own voice tile drew "Y" ("You"). A lone capital in a
circle is exactly what a monogram looks like, so all three read as a broken
initial. Statuses now take an icon; the one label that genuinely is a name —
the supplier on the other end — passes its initial explicitly, so "person" vs
"state" is stated at the call site instead of guessed from the string.

SPEC IMPACT: None.

NOT CHANGED, DELIBERATELY — both reported rather than built:
- The "Account" pill on a public event page shows a generic person outline. It
  is a labelled nav pill, not an avatar slot, and filling it needs a NEW user
  read on the hottest public route. Owner's call whether that trade is worth it.
- The create-event "who is this for?" self row keeps its monogram. Its own code
  records that as a deliberate choice, and for a named account it already shows
  the correct initial — only an account with no display name sees "Y". Reversing
  a recorded decision is not a side effect of a sweep.

⚠ PROCESS NOTE. The sweep agents read the shared checkout at ~, which is **749
commits behind origin/main**. One finding was consequently wrong: it reported
that a resolved photo was already in scope in the launcher and that this fix was
redundant. On real main that code was removed — the only remaining match is a
comment. Every finding here was re-verified against origin/main by hand before
being acted on, and two were dropped that way.
