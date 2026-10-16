# HANDOVER — Cover Scene tools (branch `rd/cover-scene-tools`, worktree `~/Documents/Claude/Projects/wt-cover-scene`)

Paused 2026-10-16 on the coordinator's order (weekly limit). **Nothing has been compiled, tested or walked yet.**
`node_modules` is installed in this worktree (pnpm install done). No heavy-lock ticket held, no server running.

⚠ **Before opening any PR: delete `HANDOVER.md` and `.handover/` from the branch** (they are committed only so they
survive the machine).

## Contract
- Corpus DECISION_LOG, all 2026-10-16: "APPROVED — THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE…", "THE COVER:
  WORDS IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT", "SHIMMER IS AN ANIMATE EFFECT FOR ANY
  TEXT · 'CONFIRM ATTENDANCE' IS THE RSVP", "THE COUPLE'S NAMES ARE THE 'EVENT TITLE'".
- Prototype **v2** (newer rulings): corpus `prototypes/cover_scene_edit_animate_2026-10-16.html` at **f484bca7**
  (pull the corpus). Words start under ≈7 % top padding (never centred); foot = RSVP button + "Swipe up for the event"
  hint (hint is NOT a part, not hideable); Shimmer only as a text part's Action ▾ + Band ▾ (no cover-level Shimmers
  row); IGNORE its "Accents as parts" panel (out of scope).
- Coordinator's build ORDER (ship (1)–(3) as their own draft PR first, stack (4)–(5)):
  (1) words upper + RSVP button + Swipe-up hint (veil + bars rules kept) · (2) Shimmer as an Action on any text ·
  (3) Cover Scene › Edit switches · (4) Style = Opening + remove the Reveal tile · (5) the one-entrance Animate.
- Walk (coordinator): ONE pass on WebKit iPhone 13 at 375 + 1280 for the guest cover. Release the lane right after.
- Draft PR, label `do-not-auto-merge`, wait for CI green; coordinator ships. Changelog fragment
  `changelog.d/cover-scene-tools.md`.
- Coordination: `rd/vintage-art-kit` (worktree `wt-art-kit`) may touch `pahina-masthead.tsx` / `globals.css` —
  check `git -C ~/Documents/Claude/Projects/wt-art-kit diff origin/main --stat` before pushing; if the same lines, tell
  the main session.

## Done in the WIP commit (uncompiled)
### (1) Words upper + RSVP button + hint — CODE WRITTEN
- `lib/cover-scene.ts`: `COVER_SCENE_UPPER` (justify-start, `pt-[clamp(36px,7svh,58px)]`), `COVER_SCENE_FOOT`,
  `COVER_FOOT_ATTR`, `COVER_SWIPE_HINT = 'Swipe up for the event'`.
- `pahina-masthead.tsx`: all four designs use `COVER_SCENE_UPPER` (The Letter now starts at the top, mark above the
  words, no `mb-auto`); new props `rsvp?: CoverRsvp | null` and `still?: boolean` (still is for (5)); a `foot` drawn
  last in every header: the RSVP button (`.button-primary`, 44 px, `data-el="rsvp"` via `el('rsvp')`,
  `data-cover-rsvp=<kind>`; ask → couple's words or "Confirm attendance"; going/declined → "You're coming ✓ · Change" /
  "You can't make it · Change"; closed/not_yet → plain `<p>`), and the hint (`data-cover-hint`, aria-hidden, chevron
  nod `cover-hint-nod`, `motion-reduce:animate-none`). Both carry `data-cover-line` so the veil hides them.
  Hidden hero parts are now `display:none` on the Maker canvas too (no ghost) — `el()` no longer passes `editor`.
- `lib/cover-rsvp.ts` (new): `CoverRsvp`, `coverRsvpOf({card, visitorHref})`, the state words.
- `lib/element-style.ts`: new hero el `rsvp` (label "RSVP button", fields `word · motion · hidden`, size bounds 100/100,
  word sanitised as a line, `HUB_RSVP_DEFAULT_WORDS = 'Confirm attendance'`, words hint).
- `site-body.tsx`: `visitorRsvp` (Invitation stage, no ticket URL → `inviteReplyPath`, which asks for the passcode
  first) on the two stranger mastheads; `guestRsvp` (from `replyCard`; on the Maker canvas the ask state when
  `plan.rsvpShouldRender`) on the two guest mastheads; while the cover holds the button (`coverHoldsReply`), the
  Welcome's `ReplyCardRow` under the cover is NOT drawn (one doorway moved; Me keeps its card) — **flag this to the
  owner**.
- `globals.css`: `@keyframes cover-hint-nod`; with no veil a foot line without its own Build in fades in at 0.8 s.
- `lib/maker-parts.ts`: new part `rsvpbutton` (label "RSVP button", canvas `f:hero`, el `rsvp`) on Invitation › home
  after `herolink`. NOT the designer's `rsvpcard` reuse: `rsvpcard` is also Me's Reply card — one key cannot be two
  places.
- `editor-bridge.tsx`: instant preview draws hidden hero parts `display:none` (was ghosted).
- NOT DONE for (1): the "Exit preview" pill must move off the foot (prototype parks it at the right edge, top ≈36 %):
  `stage-tools.tsx` → the `previewing && shellEl` portal (`data-stage-exit-preview`); the dev lab
  (`app/dev/maker-lab/guest/page.tsx`) masthead needs `rsvp={...}` (+ a `?rsvpstate=` param for the four states) to
  walk; `invitation-skeleton.tsx` draws the masthead too (check it still looks right).
### (2) Shimmer — CODE WRITTEN (lib + CSS + preview), UI NOT YET
- `element-style.ts`: `HUB_EL_DURING(_WORDS)` + `'shimmer'`, `band?: 'gold'` on `HubElementMotion` (kept only beside
  shimmer), `hubElementTakesShimmer` (parts with a colour field — never the mark or the RSVP button; sanitiser drops
  it elsewhere), `hubShimmerPaint`, `hubElementShimmer`, `HUB_SHIMMER_*`; motion slot `5s linear infinite
  el-during-shimmer` (named `el-during-*` so ▶ Action plays it); `hubElementMotionAttr` adds `data-el-shimmer=hue|gold`;
  `hubElementSceneCss` emits the paint for scene parts behind `@media (prefers-reduced-motion: no-preference)` +
  `:root:not(.sn-save-data)`.
- `globals.css`: `@keyframes el-during-shimmer` + the gated paint rule for `[data-el-shimmer]` (gold variant; the
  joiner `.text-gild` keeps its own fill).
- `pahina-motion.tsx` `PahinaMotionRootFlag`: adds class `sn-save-data` on a Save-Data connection (a class, not an
  attribute — an `<html>` attribute written pre-hydration is a mismatch).
- `editor-bridge.tsx` `applyHeroPartStyle`: sets/removes `data-el-shimmer`.
- TODO: `stage-animate.tsx` — `does` renders a `Dd` (one dropdown) when it has ≥ 3 options, plus a `band?: AnimateDd`
  row 3 (Band ▾: "Your colour, lighter" · Gold) while Action = Shimmer; `element-sheet.tsx` (`does={{…}}` near
  `StageAnimate`) offers `['still','drift','shimmer']` when `hubElementTakesShimmer(target.el)` and writes `band`
  (moveTo('band', …)); `part-inspector.tsx` already maps `HUB_EL_DURING_WORDS` (now includes shimmer — check it is
  only offered on text parts). Blocks (`block-animate.tsx`) stay Still · Drift.
- Check `elementPreview` sends a motion change so the canvas sets `data-el-shimmer` at once.
### (3) Cover Scene › Edit — PARTLY
- `element-style.ts`: `names` has no `hidden` field any more (Event title always shown; sanitiser drops it).
- `maker-parts.ts`: `makerPartToolWorks(coverscene)` = Edit + Background (Style/Animate still grey, keyed
  `MAKER_COVER_SCENE_TOOL_WHY` = style/animate only; its `edit` line was removed).
- TODO: new `stage-panel/cover-lines.tsx` (2-up pills of the cover's lines in page order, each with `PanelSwitch`;
  Event title shows no switch and a tap says "The names are the cover — they are always shown."; Logo's switch writes
  `events.logo_wanted` through the Details answer draft (`AnswerPicker` column `logo_wanted`) — same fact as Studio's
  "Show the logo on Cover and QR"; tapping a line's name picks that word). List = cover parts drawn
  (`present`) ∪ parts stored `hidden` on the hero canvas (a hidden line is no longer drawn). Hide/show = the
  `keepPartLook`-style hero canvas write of `elements[el].hidden` (see `stage-panel/part-look.ts` `keepPartLook`:
  `draftedCanvasOr` → `withElementChoice(…, 'hidden', true|null)` → `elementPreview` → `makerSave(makerLatestWrite(
  canvasWriteKey('hero')…))`). Mount it in `stage-tools.tsx` when `picked === 'coverscene' && shownTool === 'edit'`
  (instead of `StageEdit`). The word's own Edit row 2 "Shown on the cover" switch (same value) — optional delta.
### (4) Style = Opening, Reveal tile removed — NOT STARTED
- Patch ready: `.handover/maker-parts-full.patch` (removes `'reveal'` from the three page lists that lead with the
  Cover Scene; makes coverscene's four tools live; retires `MAKER_COVER_SCENE_TOOL_WHY`).
- `stage-tools.tsx`: replace `revealLeadsHere` stub painting (`revealStubHtml`, `data-maker-reveal-part`) with a corner
  tag on the cover header ("Sheer veil ◆ opens over it"; Maker only); mount `RevealPartTools` when coverscene is picked
  on Style; ▶ on coverscene with an opening = `RevealPlay`, then the entrance. Delete `revealStubHtml` and the
  globals.css "Reveal's TILE" rule. `add-part-sheet.tsx`: `makerRevealEdges(isReveal || picked === 'coverscene')`.
  Update `the-cover-scene-is-one-group.test.ts`, `a-tool-with-nothing-to-do-says-so.test.ts`.
### (5) One entrance — LIB WRITTEN, parked
- `.handover/cover-entrance.ts.txt` → `apps/web/lib/cover-entrance.ts` (COVER_ENTRANCES, `sanitizeCoverEntrance`,
  `resolveCoverEntrance`, `coverEntranceBeats`, `withoutOwnEntrance`, `coverEntranceIsStill`; drop its RSVP half,
  which now lives in `lib/cover-rsvp.ts`).
- `.handover/entrance-storage.patch`: `HubSectionCanvas.entrance` + sanitiser (hub-canvas.ts) and `'entrance'` in
  `HUB_CANVAS_LOOK_KEYS` (Pro at Apply, like part motion — decision to flag).
- site-body `heroElements`: `elements: resolveCoverEntrance(heroCanvas.entrance, heroCanvas.elements)`,
  `still: coverEntranceIsStill(heroCanvas.entrance)`; same in the dev lab guest page; `element-preview` should resolve
  for `f:hero`. UI: `stage-panel/cover-animate.tsx` (Entrance ▾ · Movement ◆ · beats line · "Reset to the cover's
  entrance ›"); word's Animate: "Follows the cover's entrance" note + reset door; ▶ = veil closed → unveil → entrance
  (`play-sequence.ts` new cover mode).

## Guards still to write (node:test via tsx, sabotage each once)
group has all four tools · Event title has no switch · a hidden line is absent for guests · entrance reaches words with
no own Build in and not words that have one · Reveal tile drawn nowhere · shimmer on any text part, off under reduced
motion · RSVP button opens the shipped reply + shows the three states · cover words in the upper part · the veil hides
every line incl. the RSVP button. Existing guards likely to need updating: `lib/the-cover-scene-is-one-group.test.ts`,
`lib/a-tool-with-nothing-to-do-says-so.test.ts`, `app/[slug]/_components/the-veil-hides-the-cover-words.test.ts`, any
test enumerating `HUB_HERO_ELEMENT_KEYS` / `HUB_EL_DURING`, `lib/free-vs-pro-redrawn.test.ts`, guest-page goldens.

## Next exact commands
```sh
cd ~/Documents/Claude/Projects/wt-cover-scene/apps/web
L=~/Documents/Claude/Projects/heavy-lock.sh
"$L" acquire "tsc cover-scene" && { pnpm typecheck; rc=$?; "$L" release "tsc cover-scene"; exit $rc; }
```
Then finish (1)–(3) TODOs above, the guards, the CI guard aggregator from `apps/web`, the changelog fragment, the walk,
and open (1)–(3) as a draft PR (`--label do-not-auto-merge`); stack (4)–(5) after.
