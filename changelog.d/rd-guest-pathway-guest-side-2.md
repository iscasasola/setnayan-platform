## 2026-09-27 · feat(guest-pathway): Me tab and the last-30-days "Your checklist" (guest side, part 2)

Items 4 and 6 of the guest pathway build brief (owner 2026-09-26/27 —
DECISION_LOG "THE LAST 30 DAYS: EACH GUEST GETS YOUR CHECKLIST", "THE GUEST
CHECKLIST IS INTERACTIVE", "A NAME MAKES A QR — FOR EVERY PLUS-ONE", "ON THE DAY
TOO").

- **Me.** Mounted INTO the one `#site-me` section (GuestHubBar's), so it rides
  both the Invitation bar and The Day bar: the guest's name + "Not you?
  Switch" · their guests — "Send their invite" (share sheet, their own link),
  "Show <name>'s pass" for a plus-one with no phone, "Add their name" for a TBA
  seat · "Save to my account" any time, method chosen by the device.
- **Your checklist** at the top of an identified guest's page in the 30 days
  before the day: what to wear (their role's dress code, else the general one) ·
  motif colours (Mood Board swatches) · arrive by (first block of the run of
  show) · venue + Open in Maps (only once the venue is open to them) · their
  table (once seated) · their QR pass (Save to Photos). Each is a tick —
  "3 of 5 ready" → "You're all set ✓" — saved to the GUEST through their own
  reply action (`submitRsvp`'s checklist branch, after the key check, touching
  nothing of the reply; +0 server actions) into `guest_checklist_ticks`, a
  service-role-only table (RLS on, no policy, grants revoked) so the couple never
  sees per-guest ticks. A failed save puts the tick back and says so; a failed
  read says so rather than showing "nothing ticked".
- **One door for a stranger, finished.** The open-browse "Find your invitation"
  card and the pre-event "Open my invitation" card no longer sit beside "Get
  inside". "Ask to join" now honours the couple's "Who can RSVP?" (only "Anyone,
  I approve" opens a request). The RSVP page's "Please reply by" and the "one
  question at a time" switch read the couple side's own readers
  (`resolveReplyBy`, `readOneAtATime`) so the Maker and the guest page say the
  same date and follow the same switch.

Migration: `20271249784825_a_guests_checklist_is_their_own.sql` (new table).
+0 server-action exports.

SPEC IMPACT: None — builds the owner's 2026-09-26/27 DECISION_LOG rows as
written.
