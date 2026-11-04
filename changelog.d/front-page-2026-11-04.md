## 2026-11-04 · feat(front-page): the signed-out `/` becomes the 4 Nov front page — hero, event types, sample, problems, plans

The owner-approved prototype `prototypes/front_page_2026-11-04.html` (DECISION_LOG 2026-11-04, "THE THREE
MARKETING PAGES GO TO CLOUD BUILD"), ported onto the shipped front door. Signed-out only; a member's `/`
(Discover) is unchanged. Draft, `do-not-auto-merge`: the owner OKs the screenshots first.

- **Hero** (`front-door-anchor.tsx` + `front-door-hero.tsx`): six crossfading photos with the turning word —
  "Your wedding, beautifully handled on Setnayan." — a "Which event?" dropdown, the 25 Oct truths and the
  Papic line (no number on the hero). The hero rule from the owner ("images are too cut"): phone covers at
  `var(--px) 28%`; from 1024px a photo with `--dr` shows its full height, anchored right; 2.5 % zoom.
  Only the first photo loads with the page.
- **The sample leads only when it opens.** `/sample` is built dark; with the switch off the main button is
  "Set up your event — free" → /start and "How it works" stays, and no link into `/sample` is drawn
  (2026-11-02: "with the sample switch off '/' falls back to the plain page").
- **Sections** (`front-door-landing.tsx`): #events (from `event_type_vocab` via `getCreatableEventTypes`,
  count read, never typed) · #sample (names, date, roles and march place from the Maria and Jose
  fixtures) · #shelves (the shipped `FrontDoorFeed`, unchanged) · #solves (20 problems) · #coordinators
  (→ /for-coordinators) · #suppliers (→ /for-suppliers) · #plans (no peso figure for Plus/Pro — no catalog
  row yet) · close · a footer carrying /privacy and /terms.
- **Photos**: 56 keys copied to `apps/web/public/marketing/2026-11-04/` (shared folder with the other two
  pages); `lib/front-page-photos.ts` maps keys to paths.
- **Guards moved, not loosened**: the headline guard pins the new approved line and still pins "one album";
  a new case pins the sample-open buttons; the Google OAuth guard reads the Privacy/Terms links from the
  page footer and checks the home page draws it; two house-word allowances with reasons.
- Regenerated `lib/ugat/screens.generated.json` and `scripts/port-control-baseline.json`.

SPEC IMPACT: None to the corpus — this ports `prototypes/front_page_2026-11-04.html` (Setnayan-specs) as
approved. Deltas from it are listed in the PR body for the owner (no price on Plus/Pro, "Try it" links to
/features until the sample's S3 pages exist, the shipped shelves keep their own headings, no video clips yet).
