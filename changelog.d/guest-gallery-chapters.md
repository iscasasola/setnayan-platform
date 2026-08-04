## 2026-08-02 · feat(papic): "Photos of you" reads in chapters too

Owner: *"yes :) it will be one event for that event."* One event, one journey —
so a guest's own photos read in the same units as the shared gallery.

`/papic/me/[token]` now groups into the same countdown (**5 months to go → 30 days
to go → The day**, or **Day 1, Day 2** on a trip), reusing the rule shipped in
#4063 rather than a second copy of it.

🪤 **Chaptered on when the photo was SHOT, never when the guest was tagged into
it.** A guest tagged today into a five-month-old planning photo belongs in the
chapter it was *taken* in. Keying on the tag time would drag every back-tagged
photo into this week and quietly rewrite the journey — and it would have looked
completely correct on a same-day event, which is every event we can test today.

The capture time now rides alongside the image key through the loader; the tag
feed still decides ORDER and membership, exactly as before.

**No heading when there is only one chapter.** A lone "The day" over six photos is
chrome, not orientation. Worth naming: the comment claiming this behaviour was
written before the code did it, and the guard now asserts the code.

⚠ Also strengthened a guard from this same feature: it matched a *name* that
survived the very mutation it was meant to catch (the map was still populated
elsewhere in the file), so it now asserts the assignment expression. A guard that
passes under its own defect is worse than no guard.

⚠ The couple's browse surface is `/papic/pool`, already chaptered in #4063 — the
account library groups by EVENT, which is the right axis there and untouched. The
8-photo preview strip on the event site stays flat: it is a teaser with a "see
all" link, not a gallery.

SPEC IMPACT: none — same rule as #4063, applied to a second surface.
