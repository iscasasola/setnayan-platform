## 2026-08-18 · fix(event-hub): a birthday stops being handed a wedding (S15)

**What a person gets.** A birthday, a graduation or a corporate day no longer
shows parts that exist only because an event is a wedding. **The owner saw the
clearest one himself: a "Story" tab on a seven-year-old's birthday.**

**The words half (S13) was the easy half.** This is the other: a seven-year-old
does not need a neutrally-worded love story, he needs **no love story**.
Rewording these would have been the wrong fix.

**THE LEAK, RE-MEASURED rather than inherited.** The event-type profile has
recorded since the type engine shipped that Save-the-Date and monogram are
wedding-only — `GENERIC_PROFILE` omits both surfaces and its own comment says
why. **The guest tree never read those answers.** Measured across all of
`app/[slug]` plus `lib/site-body-plan.ts`: `surfaceEnabled` called with
`'website'` **eleven** times, `'seating'` **once**, and those two **never**. The
body-plan resolver did not mention the event type **at all** — the page's shape
was chosen from the CALENDAR alone. So a non-wedding booked far enough ahead
rendered the **wedding Save-the-Date film**.

**New:** `lib/wedding-only-parts.ts` — one matrix, `Record` over the union, so
**adding a part without deciding its rule is a TYPE ERROR, not a silent gap**.
That is the `WIDGET_PHASES` / `WIDGET_SPOTLIGHT` shape this repo already uses,
copied rather than invented.

🔑 **DATA-DRIVEN, NOT `eventType === 'wedding'`.** A hardcoded string would be
wrong the day a vow-renewal type is added — not a wedding, wants all of these.
So each part asks the question actually true of it: the film and the monogram
ask the profile's **surface list** (which an admin owns, no deploy); the love
story and the side labels ask whether the type **has two named people**, because
that is what they are about.

**Wired at ONE chokepoint** — the body-plan resolver — not checked in three
places. Three surfaces each asking separately is how the photo-wall defect
happened.

🛡 `wedding-only-parts.test.ts` — 9 assertions. **Mutation-proved, counts
printed:** the film gate removed from the body decision, i.e. the live defect
restored (2→0) **1 fail** · the love story keyed on the WORD wedding instead of
two people (landed) **1 fail** · a part dropped from the matrix (landed)
**2 fail** · the Story tab ungated (1→0) **1 fail** · restored **9 pass**.

🪤 **AND THE FOURTH SABOTAGE PASSED ON THE FIRST RUN.** The suite tested the
resolver and the chokepoint, and ungating the Story tab in `site-body.tsx`
stayed **GREEN** — *the exact defect the owner found by opening the page, left
unguarded by the tests written to close it.* **Test the thing that was SEEN, not
only the machinery underneath it.**

⚖ **The gate is OPTIONAL and absent ⇒ everything allowed**, so every existing
caller and golden test is byte-identical. Only the guest tree passes it.

⚠ **NOT OBSERVED** — no local build, and the only non-wedding events in
production are two hand-made test rows. The owner's own screenshot is the
evidence this was real; whether it is fixed is test-proved, not seen.

SPEC IMPACT: None.
