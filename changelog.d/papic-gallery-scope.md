## 2026-08-05 · fix(papic): a coordinator was shown a third of the album as if it were all of it

The Papic gallery is three sets of photos: what the crew shot, what guests shot,
and what the couple's suppliers shot for their own records. The first two belong
to the couple. The third doesn't.

A coordinator opening that page could only read the supplier shots — and the
page rendered them as **"Your gallery"**, with nothing saying the other two
thirds had been withheld. When permission is refused, the answer comes back as
an empty list with no error, which looks exactly like a wedding where nobody
took a picture. The screen couldn't tell the difference, so it guessed wrong.

It now asks the permission question directly, rather than reading it off the
photo count. Someone without access sees the heading **"Photos shared with
you"** and a line saying the crew's and guests' photos belong to the couple and
aren't shared with them. And an empty result reads as *"nothing has been shared
with you yet"* rather than *"your gallery is empty"*.

**Nothing was granted or widened.** A coordinator's access covers the guest
list, seat plan, schedule, vendors, invitations and mood board — there is no
photo access on that list, and whether there ever should be is a decision nobody
has made. This only stops the screen implying it already happened.

SPEC IMPACT: DECISION_LOG row — the coordinator's Papic gallery view is a
disclosure fix, not a permission change; the underlying product question is
still open.
