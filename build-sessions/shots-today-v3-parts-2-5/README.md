# Today v3 parts 2–5 — 390 px, Now beside Proposed

Each image: left = part 1 (`claude/today-no-hero-photo`, #8032), right = this PR. Both from the dev lab
`/dev/supplier-lab?easy=normal&sup=studio&v2=1` (fixture data), iPhone width 390, scale 2.

| file | what |
|---|---|
| 1-list.png | the one list, closed |
| 2-review-open.png | a review row open as a card — its foot now has "Do it tomorrow" beside "Open in page ›" |
| 4-finished-open.png | "Reyes debut" finished: Now = v2's "I delivered"; Proposed (`&wrap=1`) = the wrap-up, step 1 Photos |
| 5-wrap-reviews.png · 6-wrap-confirm.png | wrap-up steps 2 and 3 (no Now — new) |
| 7-tomorrow.png | `&tomorrow=1`: a task put off sits under "Tomorrow 1", out of the count (no Now — new) |

Not shot: the drags (a finger gesture — covered by `today-rows-drag-both-ways.test.ts`), a red open card (the lab
has no red fixture), admin Focus and Admin › Settings (they need a signed-in admin and a database, which this
container does not have). The red "3 Issues" badge is the Next.js dev overlay: the container has no database, so the
brand and nav-settings reads fail — not this PR.
