## 2026-09-29 · feat(event-hub): every Save the Date, Invitation and Day scene has its three styles

Owner, 2026-09-29 (DECISION_LOG "EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE STYLES"): *"we want at
least 3 choices for each scene that are premade. even the countdown and other scenes"*. Built from the approved
design `prototypes/every_scene_three_styles_2026-09-29.html`: per scene, A is the shipped component (unchanged)
and B · C are new, each a pure props-in component beside it (`app/[slug]/_components/<scene>-styles.tsx`),
reached through a new optional `sceneStyle` prop on the shipped component. A style re-arranges the scene's
EXISTING data — no new field, no new question, no new query, no migration, no server action.

**Registered in the shared registry** (`lib/scene-styles-stages.ts` → `STAGE_SCENE_STYLE_SETS`; the framework
is the Post Event builder's `lib/scene-styles.ts`), so the Maker's one Style dropdown appears for them:
Countdown (Four tiles · Big number · The calendar) · Special message (The note · The letter · The quote) ·
Love Story (Chapters · The essay — the shipped `OurStory` full · The years) · The details (The plate · Big date,
two places · The card — the date written in words FROM the date) · Schedule (Programme rail · One chapter per
screen · Clock face — the Post Event's ids, one pick across stages) · Venue map (Map and plate · One map, two
pins · Full map — OSM tiles already in `img-src`, no drive time) · Dress code (Colours and roles · The palette ·
The line — the general view only; a known guest still sees only their own role) · What to bring (The note ·
The list · The gift line) · Camera cues (Cards · Down the day · Yes and no) · RSVP (The reply card · The
question · The ticket — same fields, same three answers, same action, one-at-a-time and the Privacy Notice
kept) · Photos you add (Mosaic · Grid · Film strip — the Post Event gallery's ids). **The default is always style A — today's look — on every stage** (controller, 2026-09-29: no surprise changes to a live
page). The prototype's Recommended shows as a "Recommended" hint on that option in the Style dropdown instead
(`recommendedStageSceneStyle`, passed to `SceneStyleRow` as `recommendedId`). An event with no stored style
renders byte-identically to `main` — held by `every-scene-style-draws.test.ts` and checked once against a
`main` checkout (all 12 scenes × 3 stages, `cmp` identical).

**Drawn but NOT registered** (no section row → no `canvas.style` for a pick to live in): Entourage (Roll call ·
Two sides · The march), Find your seat (The map · The table number · The place card), each guest's own photos
(The grid · The big one · Polaroids — every consent control kept per tile), Announcements (The banner · The
notice · The line), Live hub (Player and wall · Theatre · Wall first). Their components and `sceneStyle` props
ship and are tested; they join the registry when they have a home.

Mounts: both guest dispatchers take `stage` and resolve `canvas.style` through `lib/scene-style-of-row.ts`
(no stage → the shipped look); `site-body.tsx` passes `pageStage`, the details' and the reply card's style.
Tests: `every-scene-style-draws.test.ts` (one root + marker per style, every datum kept, withheld venue gives no
directions, solemn → no countdown, RSVP fields identical across styles, known guest's dress code, consent
controls kept), `lib/scene-styles-stages.test.ts` (≥3 per stage, every registered id is drawn, defaults),
`lib/scene-style-text.test.ts`, `lib/scene-map-tiles.test.ts` — each seen to fail once under sabotage.
`lib/details-bound.test.ts`'s mount regex now allows props beside the bound `text` (the property is unchanged).

SPEC IMPACT: DECISION_LOG.md "AS BUILT — EVERY SCENE'S THREE STYLES (Save the Date · Invitation · The Day)"
row (defaults = style A, Recommended as a hint; the five unregistered parts and the proposed home for their pick;
"The big one" in place of "the best one", since nothing counts keeps).
