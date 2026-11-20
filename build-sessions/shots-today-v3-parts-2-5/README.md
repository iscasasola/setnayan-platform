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

## Added for the 20 Nov controller review — 375 px light · 375 px dark · desktop 1280

Proposed only (this PR's head), from the same dev lab, `&tomorrow=1` / `&wrap=1`, scale 2:

| file | what |
|---|---|
| a-list-{375-light,375-dark,1280-light}.png | the one list; amber rows wear their word |
| b-this-week-tomorrow-*.png | the 20 Nov ruling's one line "This week: N events" (opens the calendar), then "Tomorrow 1" |
| c-wrap-photos-*.png · d-wrap-confirm-*.png | the wrap-up card, steps 1 and 3 |

How dark was drawn: the app turns dark only for a signed-in person on an app route (`theme-bootstrap-script.ts`), and the
dev lab is neither — so the shot adds the app's own `dark` class to `<html>` after load. The colours are the real dark
tokens; nothing else differs.

Still NOT shot, and why: **admin Focus** and **Admin › Settings** read the admin queue digest and `platform_settings`
on the server — they need a signed-in admin and a database, which this cloud container does not have (no dev lab draws
them). Their behaviour is held by `app/admin/focus-opens-in-place.test.ts`, `lib/admin/focus-urgency.test.ts` and
`app/admin/settings/today-numbers-are-the-owners.test.ts`. The drag gesture itself (a finger move) is held by
`today-rows-drag-both-ways.test.ts` and `lib/today-put-off.test.ts`.
