## 2026-10-05 · fix(maker): every guest page's DEFAULT section order, as the owner approved it

The owner approved one default section order per guest page (audit picture
`build-sessions/SECTION-ORDER-AUDIT-2026-10-05.html`). Only the default moves —
a couple who dragged their own order keeps it (the Day's
`config_json.stage_order`, Post Event's `draft_json.sectionOrder`).

- **RSVP stage** — the three screens read **RSVP form · When yes · When no**
  (`RSVP_STAGE_SCENES`, `RSVP_STAGE_TILE`); each tile's caption says what the
  screen is without repeating its title.
- **The Day** — Live + Announcements first, then find your seat · schedule ·
  venue, then photo moments · your photos · photos of you, then the entourage.
  `MAKER_DAY_PARTS` now gives each of the day's parts a place (`before` the
  stage's scenes, right `after` them, or `last`, after the entourage); the
  navigator (`makerStageList`) and the Maker canvas's stand-ins
  (`site-body.tsx` `makerDayStandIns`) both read it, so they stay one list. The
  announcement leads the live hub because a guest meets it at the top of the
  page. The guest's tabs (Live · Welcome · Camera · Gallery · Me) are unchanged,
  so the navigator now heads every RUN of a tab (`navigatorRows`): Live ·
  Welcome (find your seat) · Live (schedule · venue · camera) · Gallery (photos
  of you) · Live (entourage) — the schedule is never listed under "Welcome".
  The Invitation's Details likewise resumes under "Details" after Our Love Story.
- **Post Event** — cover → before → numbers → chapters → gallery → film →
  videos → **you** → wishes → asked → letters → seating → suppliers → entourage
  → wall → said → powered → loved → before/after → couple → song → next.
  `EDITORIAL_ORDERABLE_KEYS` reordered; "Were you there?" now follows the film
  on the page (`StorySpine you="none"`, then `you="only"` after the film block
  in `editorial-content.tsx`) and in the navigator (`draftToScenes`).
- **Invitation** — the RSVP stays right under the names (owner's answer,
  2026-10-05); Details already ends dress code → entourage. Save the Date
  unchanged.

Held by `apps/web/lib/every-stage-keeps-the-approved-order.test.ts` (each
stage's default on maria-and-jose's shape, a dragged order still winning, and
the Post Event page drawing "Were you there?" after the film);
`the-day-parts-are-in-the-maker.test.ts`, `post-event-scenes.test.ts`,
`post-event-draft.test.ts`, `every-scene-is-in-the-navigator.test.ts` and
`the-rsvp-stage-is-realtime.test.ts` re-pointed to the approved order.

SPEC IMPACT: Applies `DECISION_LOG.md` 2026-10-05 "APPROVED — EVERY GUEST
PAGE'S DEFAULT SECTION ORDER" (corpus row already written by the controller;
no further corpus edit).
