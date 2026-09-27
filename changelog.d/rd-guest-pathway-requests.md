## 2026-09-27 · feat(guests): no key, no entry — Requests replace the optimistic admit; give an unreplied spot to someone else

Guest pathway brief, items 1 + 2 + 3 (couple side). Owner rulings: DECISION_LOG
2026-09-26 "NOBODY WITHOUT A KEY", "AN UNLISTED PERSON'S ACCOUNT DOES NOT SHOW
THE EVENT", "REQUESTS IS THE ONE WORD" (verbs Keep · Remove · Link), "SWAP A
NON-REPLIER'S SPOT".

**1 · Asking is not entering.** `app/join/[eventId]/actions.ts` no longer
admits anyone off the list (`admitAsUnlisted` is gone). A person without a key —
signed in or not, from the event's poster QR or (when the couple chose "Anyone,
I approve") from the Event Hub's "Ask to join" — types their name (the list is
never shown), answers the RSVP questions the couple still asks, leaves a contact
and ticks the Terms: that is a REQUEST (`lib/guest-requests.ts`), a guest row
with NO `event_members` row and NO guest session, so nothing opens and the event
is absent from their account. A signed-in asker is remembered in the existing
`guest_claims` ledger. A typed name never binds a seat any more (it only
suggests a match to the couple); the one bind left is a signed-in account whose
email the couple themselves recorded on a `host_seeded` guest. The connect route
refuses to let a request's own email open the door. "Request sent" is the end
screen; "Only my Guest List" events tell a tokenless asker the list is the
couple's instead of "this link isn't valid". The couple is notified in-app.

**2 · Guest List → Requests.** The Claims page (route kept) is now Requests:
the waiting count as the hero, each request with its answer · seats · contact ·
age and its suggested match ("Same as Carla D."), and the shipped verbs Keep ·
Remove · Link. Keep or Link issues the key (`lib/guest-request-key.ts`): a
signed-in asker's account is bound (the event appears in their account), and
the person is emailed their personal invitation link, where "Save to my
account" waits. Remove closes the request and tells them nothing. Guests who
added themselves before this change stay inside and appear here for the couple
to decide. The roster's inline rows say "asked to join", and their Keep works
again (it posted no name line and was always refused).

**3 · Give this spot to someone else.** On a guest who has not replied, the
guest card offers the swap: the new person takes the same row — table, seats,
side, role, groups, count — a new key is issued first (`rotate_guest_qr_token`,
as the couple), the old account's hold on the seat is removed and the old
person's contact/photo/notes are cleared; they are not notified. Refused for
anyone who replied, and after the day. It rides the existing release action
(+0 exports).

**Also fixed:** "Take this seat back" called `rotate_guest_qr_token` through
the service-role client, which the function refuses without `guest_self`, so
it always failed with "release_failed". It now rotates as the couple.

Held by `lib/guest-requests.test.ts`,
`app/join/[eventId]/the-signed-in-guest-lands-on-the-event.test.ts` (rewritten
for the new rules), `lib/give-this-spot-to-someone-else.test.ts`,
`tests/db/a-request-is-not-a-membership.db.test.ts` and
`tests/db/giving-a-spot-away-kills-the-old-key.db.test.ts`. Server actions: +0.
Migrations: none.

SPEC IMPACT: None — implements the DECISION_LOG 2026-09-26 guest pathway rows
as written.
