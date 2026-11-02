## 2026-08-29 · fix(guest): the one button a guest had did nothing, and now there are two that work

**What a person gets.** A guest looking at photographs of themselves on a
celebration page now has two controls that answer the two different things they
might mean:

- **Not me** — that is somebody else; stop filing it under my name. Removes the
  tag, never the photograph.
- **Take it down** — that *is* me and I do not want it up. The tag comes off in
  the same press, and the photograph goes to a person.

🔴 **AND THE FIRST ONE HAS NEVER WORKED, ON ANY PHOTOGRAPH, FOR ANYBODY.**
`removeMyTag` filtered `source = 'auto_face'`, so it could only ever detach a
face-recognition guess. Measured in production: **2 photo tags exist in total
and both are `manual_pick` — there has never been a single `auto_face` tag**,
because face matching is switched off on every event. The button rendered on
every photo, said *"Removing…"*, revalidated the page, and left the tag exactly
where it was. No error, nothing logged, the only symptom an absence.

⚖ **AND THE NARROW VERSION WAS ANSWERING THE WRONG QUESTION.** Whether a wrong
tag came from a face model or a mis-scanned QR is our implementation detail; the
guest's problem is identical either way — a photograph of somebody else filed
under their name. The filter is gone; the scope to *their own* tag, from the
session cookie, is untouched.

🚪 **THE SECOND CONTROL IS A DOOR THAT HAS NEVER EXISTED.** A guest who scanned
a QR at a wedding and has no account could ask us for **nothing**: no settings
page exists under an event's address, and the "Report" control shipped on public
profiles and chat threads is mounted nowhere they can reach. Meanwhile the
consent box we show them at the moment we collect the photograph reads *"I can
remove my photo anytime in my settings"* and cites RA 10173. **They have no
settings.** This is the door that sentence has always implied.

🔑 **THE PHOTOGRAPH IS NOT THEIRS, SO IT IS A REQUEST AND NOT A DELETE.** It was
taken by somebody else, at somebody else's celebration, and it may hold four
other people — a button that erased it outright would let any one person in a
group shot destroy it for the rest. The tag (which *is* theirs) comes off
immediately and never waits in a queue; the photograph goes to a person.

🔑 **NOTHING HERE INVENTS A MECHANISM.** `user_reports.reporter_guest_id` has
existed since 20261108000000 for exactly this accountless person and, until
today, had one writer. What was missing was a word: `reason` allowed
nudity_sexual · violence · hate_harassment · spam · not_my_event · other, none
of which is *"that is a photograph of me and I object"*. Filed as `other` it
would arrive in the moderation queue indistinguishable from spam — and this is
the one report carrying a statutory clock.

⛔ **The new reason is deliberately NOT added to the other report entries.** A
chat thread, a public profile and a creator chapter are not photographs of the
person pressing the button, so it would be meaningless there.

🪤 **A CHECK IS WIDENED BY DROP + ADD, WHICH RETYPES THE WHOLE LIST**, and a
value quietly missing from the retype does not fail — it silently makes every
existing row of that kind un-writable. The five originals were read out of
production with `pg_get_constraintdef` rather than remembered, and a guard pins
all six. Dry-run against production inside a rolled-back transaction: the new
value is accepted, the live definition carries all seven, and `to_regclass`
confirmed nothing was left behind.

🛡 `app/[slug]/a-guest-can-ask-us.test.ts` — 5 tests, every assertion
mutation-checked with the occurrence count printed before → after, all RED: the
`auto_face` filter put back (3→4) · the takedown's session gate removed (1→0) ·
the guest id read from the form instead of the cookie (1→2) · `<TakeItDown>`
unmounted while still defined (1→0) · the reason changed to `other` (1→0) · the
admin label removed (1→0) · the retype silently dropping `not_my_event` (1→0).

🪤 **Two of my own measurements were wrong before they were right.** A fixed
1,400-character window into the function ended *inside* the note explaining the
change — `stripComments` replaces a comment with SPACES so offsets survive, and
that note is ~1,500 of them — so the guard failed for the wrong reason; it
slices to the next `export` now. And the first `auto_face` mutation counted its
own anchor string, which appears twice, so it read 2→2 while having landed.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-29.
