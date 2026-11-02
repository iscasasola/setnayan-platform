## 2026-08-21 · fix(join): signing in stops costing a guest their seat

Owner, after walking the flow: *"if they login, they just confirm if they are
coming or not, and they get their QR code?"* — they did not.

Every signed-in ending sent them to a page whose only way on was **"Go to your
dashboard"**, under the sentence *"Your personal invitation site is on its
way."* Both halves were false: the invitation exists — they had just joined it —
and the dashboard is an ORGANISER's surface, where a guest finds no celebration,
no seat and no QR. Meanwhile the guest with **no account** was redirected onto
the event page and greeted by name. **The one who signed in got the worse
ending.**

* **The join now mints the same guest session its accountless twin already
  mints**, and returns the event's own page. Four endings: the returning member,
  both clean binds, and the optimistic admit.
* 🔴 **THE ONE-LINE VERSION OF THIS FIX IS THE WHOLE BUG.** `/{slug}` decides
  "guest or stranger" from that cookie and nothing else, so swapping the
  redirect string alone typechecks, lints, passes every existing test and ships
  the STRANGER view to the person who just joined. A sabotage doing exactly that
  is in the matrix.
* 🔑 **Why minting here is legal where `lib/guest-membership-session.ts` refuses
  to.** That refusal is about RENDER time and about a GET route a Next `<Link>`
  PREFETCHED — a card scrolling into view silently rewrote which event somebody's
  single cookie named. This is a Server Action: it runs only on a real press.
  The mint stays out of that module (a test there asserts it holds none).
* The destination and the QR token come from `findGuestSeatForUser` — one read,
  slug taken **through the database embed** rather than from anything the caller
  sent, and the token re-read **live** rather than hand-carried past the bind.
* 🔒 **The organiser's ending is untouched** and now guarded twice: the couple
  branch still redirects to their dashboard, and the seat lookup refuses a
  `member_type='couple'` row outright.
* `admitAsUnlisted` **stops discarding its bind error** — the mint reads the row
  it writes, so a swallowed failure is the difference between recognised and
  stranger.
* The unlisted ending **deliberately keeps the success page**: it carries the
  only *"you weren't on the original list, so we've told the hosts"* sentence
  anywhere. It mints first, so that page's way on lands them recognised.
* The success page now says what is true and offers **Open your invitation**;
  the dashboard survives only as the fallback for an event with no public
  address.

⚠ **The cookie holds exactly ONE event and has a hard 60-day life** — minting
for this event ends cookie-recognition on any other. Already true of the
accountless path; named here rather than discovered later.

Tests: **8 db tests** (schema facts a grep cannot see — the QR default on a
self-added row, the slug coming back through the join, and each of the five
closing gates actually closing) + **9 wiring guards**. **15 sabotages, all
landed by occurrence count, all RED.** 9123 unit · 1310 db · typecheck · lint ·
`lint-port-no-lost-controls` · `doors-are-designed` ·
`an-invited-person-is-recognised` · `private-event-join-refusal` all green.

⚠ **Not observable live.** Production holds **zero** guest memberships, so no
one has ever completed this flow — the change strands nobody and cannot be
walked on the live site until somebody does. There is no render harness here, so
"the guest sees their name and their QR" is proved by neither CI nor prod.

SPEC IMPACT: None. A `DECISION_LOG.md` row is appended.
