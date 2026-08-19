## 2026-08-19 · fix(guests): three screens would have shown a broken image the day a guest had a photo

**SPEC IMPACT:** None.

`guests.photo_url` holds an **`r2://…` reference, not a URL.** Put one in an
`<img src>` and the browser renders a broken-image glyph — nothing throws,
nothing logs, and **the only symptom is an absence.**

**Three loaders handed the raw column straight to a client component:** the
**check-in desk**, the **souvenir desk**, and the **Patiktok booth tag sheet** —
all three used at the venue, on a phone, by somebody trying to identify a guest
**by their face**.

⚠ **Guaranteed, not merely possible.** The selfie writers refuse anything that is
not an `r2://` ref, and an RSVP selfie **replaces** the Google avatar that would
otherwise have passed through verbatim. So the moment a guest takes a selfie,
those three screens break for them. Nobody has hit it because no guest has a
photo yet — the same window the profile-photo bug was found in.

🔑 **AND TWO OF THE THREE CARRY AN `eslint-disable … arbitrary R2/OAuth photo
hosts` COMMENT BESIDE THE RAW REF.** The authors did not forget a step they knew
about — **they believed a stored reference would render.**

### The real defect is that there was nothing to import

The resolution block was hand-copied **byte for byte in four other loaders** —
the guest list, the seating chart, the 3D lab, the plan-3D demo. With nothing
importable, resolving was something each author had to **remember**, and three
did not.

So it is now one exported `guestPhotoDisplayUrls`, and **all seven loaders use
it** — the four working copies replaced with a call that returns the identical
shape (zero behaviour change), the three broken ones fixed.

An unsignable ref is dropped from the map, so a caller's lookup misses and it
falls back to **initials — never a broken image**.

🛡 `a-guest-face-is-resolved.test.ts` — 3 assertions over all seven loaders, so
the **eighth surface cannot forget**. Sabotages measured by occurrence count:
raw ref restored (0→1) · helper unexported (1→0) · unsignable refs kept (1→0) —
all RED.

🪤 The first M1 measurement counted the wrong string and read 2→2 while the test
correctly went red. **A mutation whose count does not move proves nothing, even
when the result looks right** — re-measured against the pattern the sabotage
actually changes.

⏭ Still open from the same trace: `guest-detail-body.tsx` reads **no photo at
all** though the row carries one — not broken, but it is the one guest screen
where you most expect a face and it always shows initials.
