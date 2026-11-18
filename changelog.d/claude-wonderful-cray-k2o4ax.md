## 2026-11-18 · fix(couple): W4 walk B2–B4 — Guests carousel no longer widens the page, one days-to-go number

From the W4 couple-side walk of live `fbd1fae`.

- **B2 · Guests overflow (406 > 390 px).** `.carousel` in `components/snap-carousel.module.css` now has `max-width: 100%; overflow-x: clip`, so the summary slides cannot widen the page. Guard: `lib/the-snap-carousel-never-widens-the-page.test.ts`. The CSS source is guarded; the exact pixel at 390 px was not re-measured in a browser here.
- **B3 · Guests counts while loading: NOT changed.** The kept copy drawing its own count is the owner's 16 Oct "opens from the phone" design (pinned by `the-guest-list-opens-from-the-phone.test.ts`), labelled "Your last copy · updating…". Hiding the counts is a design change — left as an owner question.
- **B4 · "212 days to go" (Home) vs "213" (Schedule).** Schedule subtracted calendar days; Home uses the countdown's rule (whole days of real time left). New shared `daysToGoCount` in `lib/countdown-target.ts`, read by Schedule. Guard: `lib/days-to-go-is-one-calculation.test.ts`.
- **B1 and B5: no code change.** B1's named controls already wear the shared 46 px halos (`.ab::after`, `.sn-hit`, `.sn-hit-2d`, `.hc-tiny::before`) that a bounding-box measure cannot see; B5 needs an owner call (two different denominators). See the PR.

SPEC IMPACT: None.
