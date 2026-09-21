## 2026-09-20 · feat(monogram): one toggle — "Create your own" · "Upload your monogram"

Owner, asked where the "Both ways to make it" link and the "Vector Studio ·
Design your mark from scratch" heading should move: *"make a toggle. what will
switch which editor or uploader will show under. under it is the animate."* —
then, on the labels: *"Create your own or Upload your monogram … a toggle with
labels on which editor will show."*

The page is now three things, top to bottom: **the toggle**, **the editor or the
uploader** it selects, and **the reveal**. It replaces a chooser SCREEN (two
large door cards to pass through), the "Both ways to make it" link back to it,
and a heading-plus-paragraph inside each door — four pieces of navigation for
one binary choice. What the upload heading explained lives in `<UploadTips>`.

There is always a side now — no "neither" state. With nothing asked, it opens on
the upload side for a couple whose mark is an uploaded logo they have not yet
composed from, and on the studio otherwise. Each side is a real link carrying
`?mode=`, so Back and refresh keep the side you were on.

**Port-control baseline regenerated — for deliberate removals, and it records
something it never saw before.** The diff is four readable lines:

    - "/dashboard/[seg]/monogram"                 the "Both ways" link, removed
    + "/dashboard/[seg]/monogram?mode=design"     the toggle's two sides,
    + "/dashboard/[seg]/monogram?mode=upload"     recorded for the first time
    - MarkDoors  /  + MarkToggle

The chooser built its `?mode=` links through a `href(mode)` helper, which the
guard cannot follow statically, so they were NEVER in its baseline — the page's
only recorded destination was the plain link. The toggle writes both hrefs out
literally, so deleting either side now turns the guard red.

🔑 Correction recorded rather than buried: the first draft of the toggle's
comment claimed the guard had wrongly reported a lost route. It had not — the
plain link really was removed, and the guard keeps the query string as part of
the key. The comment now states what was measured.

`mark-doors.tsx` is deleted, not left unmounted.

SPEC IMPACT: None.
