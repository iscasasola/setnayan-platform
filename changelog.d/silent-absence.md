## 2026-08-05 · fix(guest-site): a read that FAILED stops being rendered as a thing that isn't there

**SPEC IMPACT:** None.

The same disease `door-truth` closed one layer up, found again deeper in the same
file. `const { data } = await …` discards the error, and supabase-js returns
`null`/`[]` on failure — the exact value that means "nothing here".

**1 · The whole invitation could go blank.** `loadWidgets` discarded its error,
so a one-second database hiccup returned `[]`. `widgetShouldRender(null)` is
FALSE, so that does not hide one section: the hero (the couple's names and date),
the greeting, the guest's own entry QR and the RSVP gate **all go false
together**. The guest gets a nearly empty page with nothing saying anything went
wrong, and concludes the couple never filled their invitation in. Verified in
prod: **every event has exactly 16 widget rows, seeded at creation** — an empty
list is unreachable any other way. Now throws to `app/[slug]/error.tsx`.

**2 · A guest could be asked for their face scan twice.** The enrolment probe
discarded its error, so a failed read looked like "never enrolled". Of the two
ways to be wrong about biometric consent, re-asking is worse — it is a fresh
collection prompt aimed at someone who already decided. Now fails toward silence.

**3 · The 3D venue blamed a couple who does not exist.** `public_venue_scene`
returns `{"published": false}` with **no error** when no event matches the slug,
so a mistyped address was told a specific couple had not posted their seating
plan. The "← Back to the wedding" button then dead-ended on a 404. This was the
only guest sub-route with no existence check. Now `notFound()`, using the row it
was already reading. The remaining plate splits in two — a broken read says "try
again now", an unpublished plan says "come back later" — and the copy stops
hardcoding *the couple* / *the wedding* on a route that also serves birthdays,
debuts and christenings.

🔑 **The answer is not always "throw".** `silent-absence.test.ts` also PINS two
deliberate soft failures so a later sweep does not "fix" them: the seat lookup
("Not yet assigned" is a normal state on most events, and neutral), and the
vendor doorway (a throw would blank the invitation for every guest because a
vendor table hiccuped). All five assertions mutation-verified.

**4 · A capital letter closed the one door offered to a relative.** 8 of the 10
guest sub-routes match the slug with `.ilike`, like the invitation itself. Two
used `.eq` — `invite` and `venue` — so the same forwarded link that opened
`/Cale-Ice` made `/Cale-Ice/invite` say the link was invalid and `/Cale-Ice/venue`
a dead end. `invite` is exactly where the menu's **Join** tab sends a visitor
with no invitation. Both now match like everything else, and the test sweeps the
whole route folder so a new sub-route cannot reintroduce it.
