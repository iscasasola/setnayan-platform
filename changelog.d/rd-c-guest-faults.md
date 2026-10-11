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

SPEC IMPACT: Yes — these change rulings on record (the landing before a reply
2026-10-01, the reply sheet 2026-09-20, the film 2026-06-19 / 2026-08-05, the
face screen 2026-09-30, replies in the Save the Date stage). The DECISION_LOG
rows for the owner's 2026-10-11 answers are the controller's to write (the
builder heard them second-hand); none was written from this branch.
