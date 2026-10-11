## 2026-10-11 · fix(guest): the invited guest's faults — a named guest's walk of a real event (Batch C)

An independent tester walked a real test event as a named guest on a phone
(375×812) and listed 25 faults, N01–N25. These are the ones that were plainly
wrong and needed no design decision. Built, not live. One commit each.

**N06 · An event with no date never prints a sentence with a hole in it.** The
Event Hub's line read "We'd love to celebrate with you on . You're joining us
as Guest · Both sides." — the date's words were empty and the "on" stayed.
`app/[slug]/_components/site-body.tsx` (`greetingBlock`): with no date the line
is "We'd love to celebrate with you. You're joining us as…" (solemn: "We hope
you can be with us.") — the words the Maker's own drawing of this line already
used. `app/[slug]/welcome/page.tsx`: the plus-one's door no longer ends
"Marco & Marga · ". The Event details list says "Date · To be confirmed"
instead of a dash. The five waiting states that say "on the day" (find-seat,
find-my-table, seat, venue, hub) add "The date is still to be confirmed." when
the event has none (`app/[slug]/_lib/day-words.ts` `withDayNote`). The film,
the countdown, the landing, the keepsake and the checklist were read and
already had a no-date form.
Guard: `lib/a-dateless-event-prints-no-hole.test.ts` (draws the real guest
page with no date; names any new bare `formatEventDate(` under `app/[slug]`).

**N07 · The loading screen is never another stage's page.** On an event in its
Save the Date stage the Event Hub's loading screen drew the INVITATION's cover
(the names stacked, "invite you to celebrate their wedding", "the day, the
place, the story ↓", two grey cards) for ~1.5 s, then the full-screen film
replaced it whole. `app/[slug]/_lib/loading-stage.ts` (`loadingScreenFor`)
asks, from facts the page already holds before its slow reads (the venue's
clock, the couple's pin, the event type, film-or-photos, `?film=0`), whether
the page about to appear is the full-screen film; if it is — or a `?phase=`
in the address means it may be — `InvitationSkeleton` draws its quiet form:
the couple's mark on the page's own ground and nothing else. The Invitation
and The Day keep the skeleton the owner chose on 2026-09-27; the Maker's
canvas is untouched.
Guard: `app/[slug]/_components/the-loading-screen-is-this-stages.test.ts`
(the rule and `resolveSiteBodyPlan` on all 960 combinations; the quiet screen
rendered).

**N11 · Me has the page's own side gutter.** On a page that is one scroll (the
Save the Date, Post Event) Me is drawn by `GuestHubBar` as a sibling of the
page, outside its column, and every line ran edge to edge at 320 / 375 / 390 /
768. `GuestMeSection` (`app/[slug]/_components/guest-hub-bar.tsx`) now sets
that section in the page's own column (`ME_OWN_COLUMN`: the plate, `px-4`,
`sm:px-6` — the classes of the Save the Date page's column and the shell's).
The tabbed Me (Invitation · The Day) already had its gutter and is unchanged.
Guard: `app/[slug]/_components/me-has-the-pages-gutter.test.ts`.

**N14 · Back closes the reply sheet.** A door to the sheet is a plain link to
`#your-details`, so it adds a history entry; pressing Back took the address
away and the sheet stayed up over the page and the bar. The sheet's address
listener (`rsvp-sheet.tsx`, on `hashchange` and `popstate`) now asks one rule,
`sheetAfterAddressChange` (`rsvp-sheet-state.ts`): the address asks for the
sheet → open; the address that opened it has gone → close (the same close as
the "Close" button, which hands the reading position back); a sheet reopened
by a refused save, with no fragment, is left alone. The card inside is not
touched.
Guard: `app/[slug]/_components/back-closes-the-reply-sheet.test.ts`.

**N19 · "Also coming" lists only guests who said yes.** `/[slug]/everyone`
listed every plain guest on the list under "Also coming" — people who had not
replied, people who had declined, and the reader before they answered. The
read now asks for each guest's own answer and the list is
`guestsWhoSaidYes(...)` (`lib/entourage.ts`: `rsvp_status = 'attending'`);
with nobody yet it says "No one else has said yes yet." WHO may read the
names is unchanged — the owner's 2026-09-15 ruling (guests and hosts only, a
read that never happens for anyone else), in the event's Name style.
Guard: `app/[slug]/everyone/only-guests-see-the-guests.test.ts` (two new
tests; `a-failed-read-is-not-an-absence.test.ts` re-aimed at the new sentence).

**N21 · The verb after the hosts' names agrees with how many they are.**
"Marco & Marga hasn't set up e-gifts yet." (`app/[slug]/pabuya/page.tsx`) and
"Marco & Marga hasn't published their wedding recap."
(`app/[slug]/recap/page.tsx`) now read "haven't" for two people and "hasn't"
for one, through `hasntAfter` (`app/[slug]/_lib/names-verb.ts`) — which asks
the masthead's own split (`splitCoupleNames` + `EventWords.twoPeople`), so the
cover and the sentence cannot disagree about the same name.
Guard: `app/[slug]/_lib/names-verb.test.ts` (also names any guest page that
puts a fixed singular verb straight after the event's name).

**N13 · "Sign out of this invitation" can be read, and the first press asks.**
It was 12px at 3.0:1 mid-page and one press signed the guest out (the pass in
this browser gone, the face-tagging selfie erased). Now 14px at 5.4:1 with a
44px press, and `SignOutOfInvitation`
(`app/[slug]/_components/sign-out-of-invitation.tsx`) asks in place on the
first press — "You'll need your invitation link or your QR to get back in." ·
Stay · Sign out — and signs out on the second. Same POST, still the page's one
sign-out; with script off it is the plain one-press submit it was. Its place
on the page is unchanged. `lib/site-body-fixture.golden.html` and
`lib/every-stage-is-todays-page.golden.json` regenerated: the 14 guest pages
each moved by exactly this markup (+84 bytes), the 14 stranger pages not at all.
Guard: `app/[slug]/_components/the-sign-out-asks-first.test.ts`.

**N22 · N23 — only on the pages above.** `/[slug]/everyone`: its three grey
sentences 3.98 → 5.40:1 and its back link 40 → 44px; the seat pages' waiting
sentence (`PromptCard` in `seat` and `find-my-table`) and the hub's "Your table
shows here on the day." to 5.40:1; the back links of `seat`, `find-my-table`,
`find-seat` (waiting state) and `venue` (waiting state) to 44px tall. The rest
of the walk's 78 faint texts and small presses are NOT built — the film's
"See our page", the reply card and the face screen are ruled designs.
Guard: `app/[slug]/_lib/the-walked-pages-read-and-press.test.ts`.

**Not built, on purpose.** N12 ("with Apple" once, then "with Google"): not a
fault of the product — measured: the walker's browser gives a service worker's
page request the machine's real user agent instead of the emulated iPhone's,
and the app's worker answers every page load after the first; a real phone has
one user agent for both. N17 (the camera opens before the 18+ tick): that is
the face screen the owner approved on 2026-09-30 ("Camera first", frame A) —
stopped and reported, not changed. N02 · N04 · N05 · N08 · N09 · N10 · N16 ·
N18 · N20 are the owner's calls (options in the builder's report).

SPEC IMPACT: None.

## 2026-10-11 · feat(guest): the owner's ten answers to the guest walk, and two faults found on the way (Batch C)

The owner answered the options list with "ok all" (relayed by the controller,
2026-10-11). Built, not live. One commit each.

**Post Event's loading screen** (found while fixing N07). After the day the
page is the story, not the invitation's cover; `loadingScreenFor` now answers
"quiet" for it too (`stageIsTheStory`, the plan's own `showEditorial` fact).
Guard: `the-loading-screen-is-this-stages.test.ts` (the plan on 960 combinations).

**The hub's greeting says only as much of the date as the hosts decided**
(found while fixing N06). `events.event_date` holds a placeholder day when
`event_date_precision` is 'month' or 'year', and the greeting printed it in
full. `greetingWhen` (`app/[slug]/_lib/day-words.ts`) asks the same formatter
`lib/join-door-meta.ts` does: "…with you in August 2027." / "…with you
sometime in 2027." / a real day as before. `loadEventShell` now reads the
column. NOT changed: the cover and the film still print `event_date` in full.
Guard: `lib/a-dateless-event-prints-no-hole.test.ts` (1b).

**7 · N18 — a yes needs a mobile number of at least seven digits.** The card
marked Mobile "(required)" and "abc" went through: both halves only asked
"is it empty?". `mobileIsEnough` (`lib/mobile-number.ts`: digits counted after
spaces, dashes, +, brackets and dots are taken away) is now asked by the
server (`submitRsvp`, for a yes on an open list when the couple asks for a
mobile — nothing is written, the guest comes back to `?rsvp=mobile`) and by the
browser (`ReplyForm`'s own handler, before it sends: the form is kept and the
same sentence shows under the button). A no is never asked. The card's HTML is
unchanged (its record still matches). The key gate is unchanged.
Guard: `lib/mobile-number.test.ts`.

**10 · N17 — face registration: the camera starts only when "I'm 18+ and agree
to face tagging" is ticked.** ⚠ This CHANGES the screen approved on 2026-09-30
("Camera first", frame A), by the owner's word of 2026-10-11. It is the same
one screen (`app/[slug]/_components/selfie-capture.tsx`): until the tick the
camera area is the still ground and the oval — no stream, no permission
prompt, no spinner; ticking starts the camera (`cameraMayStart`), unticking
stops it and releases it. "Take selfie" now also waits for the camera to
answer (a press in the second it takes to start was told "camera blocked").
No word on the screen changed.
Guard: `app/[slug]/_components/the-camera-waits-for-the-tick.test.ts`.

**8 · N20 — the three seat pages share ONE waiting state, with ONE sentence.**
`/find-seat`, `/seat` and `/find-my-table` each had a title and a promise of
their own before seats are shown. They now draw `SeatsShowOnTheDay`
(`app/[slug]/_components/seats-show-on-the-day.tsx`): "Your seat shows on the
day" · "Come back to this page on the day and you'll find your table." — plus
"The date is still to be confirmed." when the event has no date. No frame,
nothing to press; each page keeps its own shell and way back. The rule under
it (2026-09-30, `guestsMaySeeSeatsFor`) is unchanged. `/find-seat` keeps its
"Find your seat · soon" header and the room placeholder around it.
Guard: `app/[slug]/_components/seats-show-on-the-day.test.ts`.

**1 · 2 · 9 · N04 · N05 · N02 — the landing ("Your invitation").** One commit:
the three are the same component and page.
- **2 · Until the invitation has launched, the guest is shown "Save the Date"
  and asked for nothing.** One rule — `replyAskedInStage`
  (`lib/invitation-widgets.ts`), read by the landing as
  `replyIsAsked(destination)` (`lib/invite-destination.ts`); both are the
  lifecycle engine's own stage (clock, pin, solemn register), no new
  threshold. While the stage is the Save the Date: the landing draws
  `LandingSaveTheDate` (eyebrow "Save the Date", the couple's words without
  "Please reply below…", ONE button "Open the save the date", no ticket); the
  Event Hub has no reply on the page (`rsvpReplyOpen` — open browsing too), no
  "RSVP" under the mark (`resolveArrivalAction` `replyOpen`), no "Reply to the
  invitation" on Me, and the key gate sends nobody to the reply. ⚠ This closes
  the reply for EVERY event in its Save the Date stage, not only one with no
  date; a couple who wants replies sooner pins "Invitation". The reply page
  itself still answers a typed address (it has no stage reading).
  Also: the action under the mark is no longer offered on ANY page whose reply
  is not open (The Day without open browsing, Post Event) — it pointed at a
  sheet that was not there. `every-stage-is-todays-page.golden.json`
  regenerated: those ten guest pages lost exactly that row (−387 bytes), and
  the Save the Date · browse page its sheet.
- **1 · When and where, one line, above the Reply button**
  (`landingWhenWhere`, `lib/guest-landing.ts`): the reply door's own line
  (`joinDoorMeta`) plus the ceremony's time beside a real day, read through
  the guests' own schedule read (public, for-everyone moments). Nothing set,
  no line.
- **9 · Under the faint ticket: "Your ticket — ready once you reply."** Not
  drawn on the Save the Date landing (no reply is offered there, so neither
  the ticket nor its line).
Guard: `lib/the-reply-waits-for-the-invitation.test.ts`
(`site-body-plan.openbrowse.test.ts` re-aimed for the Save the Date).

**3 · 4 · N10 · N16 — one reply form: every reply door opens the reply page; a
guest is never served the reply sheet.** Me's button opened a sheet ("Save
RSVP", no Terms tick, sendable with no answer) while the top "RSVP" loaded the
reply page ("Send my reply", Terms tick, an answer required). Now every door —
the action under the mark (`resolveArrivalAction`), the reply card, the lead
card (`SpotlightCard`), the reply section's line, the ticket's "Reply to the
invitation" and "Change your reply" on Me (tabbed and one-scroll), and the
account connect route — goes to `inviteReplyPath(slug)`. The sheet is not
drawn for a guest (`replySheetDrawn = plan.rsvpShouldRender && isEditorCanvas`,
`site-body.tsx`). The scan-trail opt-out, which lived at the foot of the sheet,
now stands directly above "Sign out of this invitation" (RA 10173 — moved,
never gone). The reply card itself is untouched (its record still matches).
LEFT, AND WHY: `rsvp-sheet.tsx` / `rsvp-sheet-state.ts` and the sheet's mount
stay for the Maker's canvas — the Maker's own "RSVP page" opens the Event Hub
with the sheet up (`lib/maker-made-once-pages.ts`, a Maker file) and edits the
card through it; deleting them is a Maker change. N14's Back fix still holds
for that sheet. The Event Hub page's `?rsvp=` flash lines stay (harmless: no
form on the page posts there any more). N16 (the 268px "Nº" header inside the
sheet) is moot — no guest reaches a sheet.
`site-body-fixture.golden.html` and `every-stage-is-todays-page.golden.json`
regenerated: the four guest pages whose reply is open lost the sheet (~8.8 KB
each) and nothing else; no stranger page moved.
Guard: `app/[slug]/_components/one-reply-form.test.ts` (ten older guards
re-aimed from the sheet's anchor to the reply page).

**5 · 6 · N08 · N09 — the Save-the-Date film plays in full once per phone, and
on an event with no date its closing card is the page.**
- **Once per phone** (`lib/std-film-seen.ts`, `StdFilmHandoff`): when the
  guest leaves the film ("See our page") or the film ends, this phone
  remembers it — `localStorage`, one key per event (`sn:std-film-seen:<event
  public id>`), no account, nothing sent to us. On later visits the page is
  there straight away with "Watch our film again"; a one-line script before
  paint keeps the film (still in the server's HTML) from being drawn while the
  page's script loads. Clearing the browser's site data, a private window or a
  different browser shows the film once more; a browser that refuses storage
  shows it every visit, as before. A lift the page made itself (landing on a
  section) does not count as watching it. Not in the Maker's canvas.
- **"See our page" while it plays**: both controls are 44px on the glass at
  every screen (`stagePressPx` — the film's stage is scaled, so 44 stage px
  was 37px at 375 and 32px at 320), and the persistent one is there from the
  moment the film starts (≤ 0.7 s with no opening playing; with a paid opening,
  when the opening lifts — unchanged). "Watch our film again" is 44px too.
- **No date → the closing card is the top of the page**: `closing` on
  `StdFilmHandoff` draws the Save the Date's own still view (`SaveTheDateView`
  with the film off — "Save the date", the names, "Full invitation to follow.
  We can't wait to celebrate with you.") above the page, so after the film, or
  instead of it on later visits, the guest is on that card. With a date,
  nothing is added.
`every-stage-is-todays-page.golden.json` regenerated: the Save the Date pages
gained the film's wrapper (+33 bytes; +282 where the film itself plays, for
the one line of style and script).
Guard: `lib/std-film-seen.test.ts`.

**Two older guards re-aimed after the whole preflight** (it found them; both
are consequences, not new faults): `every-stage-keeps-the-approved-order`
— the Maker's Save the Date stage list no longer holds the reply (the list IS
what guests are shown; every other row is the 2026-10-05 approved order) — and
`a-guests-pages-are-filed-like-the-makers` — one fewer `home` group (the
scan-trail switch moved beside the sign-out). ⚠ The first is a visible change
in the Maker: on an open-browsing event the Save the Date stage loses its RSVP
tile. No Maker file was edited; it follows the shared plan.

**Release fix A — the record note has the page's gutter and can be read.** On
the Save the Date (a full-bleed stage: no shell column) the guest's foot — the
scan-trail note and the sign-out — sat outside the film's page column, so the
note ran edge to edge at 320 / 375 / 390 / 768. The foot is now set in the
page's own column there (`PAGE_COLUMN`, `app/[slug]/_lib/measures.ts` — the
same classes Me uses); the note is `text-ink/70` (5.4:1, was 3.98) and its
button says its 44px. It does not ask first: the press only flips the guest's
one setting, nothing is deleted, and the same button puts it back. Its words
already follow the event's own word (`w.eventWord`) — "wedding" only on a
wedding. `every-stage-is-todays-page.golden.json`: 8 one-scroll guest pages
gained the foot's wrapper (+48 bytes; +86 on the film page).
Guard: `me-has-the-pages-gutter.test.ts` (4) (5).

SPEC IMPACT: Yes — these change rulings on record (the landing before a reply
2026-10-01, the reply sheet 2026-09-20, the film 2026-06-19 / 2026-08-05, the
face screen 2026-09-30, replies in the Save the Date stage). The DECISION_LOG
rows for the owner's 2026-10-11 answers are the controller's to write (the
builder heard them second-hand); none was written from this branch.
