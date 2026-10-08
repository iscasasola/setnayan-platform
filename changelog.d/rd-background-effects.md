## 2026-10-08 · feat(look): the main background can carry an effect — stored on every shape, a plain colour included (amendment PR 3, step 1)

Owner, verbatim (2026-10-08, DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"):
*"Effects: Lantern / Parallax / etc"* · *"on the effects, i also want the gold shimmer and
bokeh lights"* · *"the effects like lanters has a color on the lantern, same petal color,
sparkle color. so, show color choice"*. Contract:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A / § 3 / § 8 PR 3. Local commit.

- **Storage — one more key, no migration.** `widgets.hero.main.effect = { kind, intensity,
  colour? }` on the hero row's `config_json` (jsonb, read only through
  `sanitizeHubMainGround`). `kind` is one of six (lanterns · petals · sparkles · capiz ·
  shimmer · bokeh), `intensity` subtle · standard · lavish, `colour` a palette SLOT by the
  palette's own names (`MAIN_SLOT`: dominant · supporting · accent · neutral · accent2) —
  never a hex, so an effect follows the Mood Board when the five change. No colour = the
  effect's own ("Original"); the word `original` is never stored.
- **Why it had to be widened first:** the sanitiser builds each shape field by field, so an
  effect written on ANY shape was silently dropped on the next read. It is now kept on every
  one — the cover follow, the page's own, a plain colour (`{ ground: 'none' }`), a pattern, a
  video of ours, their photo, their clip — as the LAST key, so a shape with no effect reads
  byte for byte as before (held by a fixture written out by hand, not derived).
- **Drops rather than repairs:** an unknown kind or amount drops the whole effect and leaves
  the background untouched; an unknown colour (a hex, `original`) is the effect's own.
  Candlelight is not an effect.
- Nothing draws an effect yet (the next commits), and nothing writes one.

Guard: `lib/the-main-background-keeps-its-effect.test.ts` (5, new) — 108 effects × 7 shapes
round-trip; the no-effect fixture; broken effects; the vocabulary equals `MAIN_SLOT`'s keys;
the fade bar leaves the effect where it is. 11 sabotages seen red.

⚠ NOT MEASURED — the Maker's first-load budget. `sanitizeHubMainGround` is reached from
`lib/hub-draft.ts`, which is in the Maker's first load, so the widening adds bytes there
(three short word lists and ~10 lines; my estimate 0.15–0.25 KB gzipped). The budget had
0.1 KB of room on the tree COMMON.md names. No `next build` was run here (not allowed) —
`check-maker-js-budget.mjs` must be read on the first build that includes this commit.

SPEC IMPACT: None beyond the contract above.

## 2026-10-08 · feat(look): the six effects' ONE engine and ONE layer — shapes and a stylesheet, nothing fetched (amendment PR 3, step 2)

Contract: the note's § 2.A "The effects — art direction" and § 8 PR 3; the approved
prototype's `fxHTML` + `.fx-*`, translated rule for rule. Local commit.

- `lib/ambient-effects.ts` (pure) — Lanterns ◆ · Falling petals ◆ · Sparkles · Capiz glow ◆ ·
  Gold shimmer ◆ · Bokeh lights: the counts (the note's table; Subtle × 0.6 · Lavish × 1.5;
  capped at 24), the seeded shapes at three depths (size · blur · opacity), each with a
  NEGATIVE delay; the colour rule (the picked palette colour is the body, pulled until it
  stands 2.4:1 off the ground; highlight = 40 % toward white, deep = 35 % toward black); the
  ground an effect lies on (`ambientGround` — the picture's measured colours under its veil,
  a blend's ramp, or the page colour); and the stylesheet as one string.
- `app/[slug]/_components/ambient-effect.tsx` — the one layer: `<i>` shapes and one
  `<style>`. No client JavaScript, no image, no font. Nothing mounts it yet (next commits).
- **What moves:** only `transform` · `translate` · `rotate` · `scale` · `opacity`. The
  prototype's sway animated `margin-left` (layout) — here it is `translate`.
- **Reduce motion = a finished still:** the animation is PAUSED, never removed.
  🪤 Measured in a browser: the first build's pause did nothing — each shape's own rule is
  more specific and its `animation` shorthand set the play state back to running (596
  animations running under reduce motion). The pause is `!important`; measured again: 0
  running, 596 paused.
- **No `color-mix()`:** every wash a glow, a rim or a shell needs is worked out in the
  engine and handed down as a variable — on a phone without the function the prototype's
  lantern glow and the whole capiz shell would vanish.
- **The travel is the layer's own height** (`cqh`, the viewport where a browser lacks it),
  so the same shapes cross a card, the sample screen and a full phone page.

Reused (Rule 0), said plainly: none of the three shipped engines' CODE — the celebration
engine is a canvas on requestAnimationFrame for a timed moment, the reveal's petals an
opening flourish, the spatial backdrop 1024² images; each would put a script, a canvas or
image requests on every guest page. Reused: the approved prototype's engine, the page's own
contrast maths (`lib/hub-legibility.ts`), the palette's slot names.

SEEN in a headless browser, on a static page rendered from the engine (not yet the app):
all six on a light and a dark ground, Original and a palette colour, with their miniatures;
requests for an effect: 0. ms/frame while scrolling a page under a full-phone Lavish layer
(375 × 812, 3 s each): 8.3 mean / 9.3 p95 for every effect, the same as a page with none —
also with the CPU slowed ×4. That is the headless browser's own 120 Hz clock: it says the
page's thread stays free (the shapes move on the compositor); it does NOT measure a real
phone's GPU, which is slower. To be measured again on the review copy once mounted.

Guard: `lib/the-effects-are-six-and-cost-nothing.test.ts` (8, new). 23 sabotages: 22 red;
ONE STAYED GREEN — removing the count cap: no effect reaches 24 shapes today (Sparkles
Lavish is exactly 24), so the cap cannot be exercised; the table and "never above the cap"
are what the guard holds.

Deviations from the prototype, each with its reason: the ground's light/dark and the 2.4
pull are worked out over what the page REALLY draws (the picture under its veil or paper
scrim), not the raw picture average; Sparkles' Original on a light page (the couple's
Supporting) is pulled like a picked colour, or a pale one would not show at all.
NOT built: Low Power Mode / a low battery showing the still (it needs a script on the
guest page; the layer has none) — the browser's own reduce-motion setting is honoured.

SPEC IMPACT: None beyond the contract above.

## 2026-10-08 · feat(look): Background › Effects — a carousel of live miniatures, How much ▾ and Colour ▾, on the sample at the tap (amendment PR 3, step 3)

Owner, verbatim (2026-10-08): *"improve the overall look of these effect"* · *"show color
choice"* · *"open choices not just switch automatically"*. Prototype frames A07 · A21–A29;
the approved gallery's kinds 5 (Style card) and 20 (Pro mark). Local commit.

- **Where:** Studio › Look › Background, under the source's own rows, on EVERY source
  (`background-effects.tsx`, drawn by the Background panel wherever the sample screen is).
  An "Effects" row (ⓘ; says Off or the effect's name), then the strip: **None · Lanterns ◆ ·
  Falling petals ◆ · Sparkles · Capiz glow ◆ · Gold shimmer ◆ · Bokeh lights**.
- **The cards** are the shipped Style card (`BgCard` / `BgCards`: 112 × 149, no frame, the
  picked one ringed and named in the accent and centred in its row). Each is a LIVE
  miniature — the same engine, the same shapes at half size — over the couple's real
  background with two small lines of words, on the ground the SAMPLE SCREEN measured
  (`lib/look-sample-store.ts` `tellLookSampleWorn`): the same light/dark variant, the same
  pulled colour. Until the sample has said what it is drawing over, a card shows the
  background alone — never a guessed effect. One stylesheet for the whole strip.
- **How much ▾** Subtle · Standard · Lavish and **Colour ▾** Original · then the five by
  name with their circles — both `PickMenu`, each OPENS its choices; shown only while an
  effect is on. No free picker. "Original" takes the colour key off; the word is not stored.
- **Starts gentle over a ground that moves:** turned on from None over a video of ours, the
  page's own film or a clip of theirs, an effect starts at Subtle; over a still, at Standard.
  Switching from one effect to another keeps the couple's own How much and Colour.
- **Another background keeps the effect** — picking a scene, a video, a colour or an upload
  no longer needs the effect picked again (`keepEffect`, in the panel's one pick path, and
  in the cover photo's own measurement write).
- **◆ tried, never applied:** a couple without Event Hub Pro may tap a ◆ effect — the sample
  wears it, NOTHING is written, the ring stays where the draft is, and one note says
  "<Effect> is part of Pro · Pro also gives you scenes, films and your own music. You can
  keep trying it on the preview." with **Not now** · **See Pro** (the approved gallery's
  words). How much and Colour on a tried effect stay tries. Leaving the panel, Not now, or
  any real pick puts the sample back.
- **The sample screen** draws the effect over the background and its veil, under the words
  (`lookSampleEffect` — the answer the guest page will ask too, next commit).
- The two free-couple lock titles "Candlelight and motion" → **"Effects and motion"**
  (`website/editor/page.tsx`, `details/_components/record-editor.tsx`).
  ⚠ The owner has not chosen these words.

control → kind: the seven cards → Style card · ◆ → Pro mark · How much ▾, Colour ▾ →
Dropdown · the Effects row → Form row with ⓘ · Not now → Action button (second) · See Pro →
Action button (main, a link).

Requests, counted by reading the one pick path (`pickLook`) — not with a stubbed client:
- putting an effect on, changing How much or Colour, taking it off: **1 draft write, 0
  whole-Maker renders, no `router.refresh()`**. The effect's layer is the page's own
  drawing, so the hidden stage canvas is owed ONE redraw — held while the sample is the
  screen, and made once when a page is next shown, however many picks were made.
- trying a ◆ effect: **0**. Not now: 0. Opening the Background tab: +0 (the cards are
  shapes; the background picture in each card is the address the source's own card and the
  sample already drew — no new file).
- before this commit: the controls did not exist.

Guard: `lib/the-effects-are-picked-on-the-sample.test.ts` (9, new) — the pure rules run;
the carousel RENDERED (order, ring, ◆, rows, the Pro note); the panel's path read (a try
reaches no save; an effect write is `pickLook(…, { fx: true })`); the sample's wiring; the
store. `a-background-pick-shows-at-once` 8/8 with the new redraw rule. 34 sabotages seen red.

Deviations from the prototype, each with its reason:
1. **The carousel is in the panel, not in an "Effects ▾" sheet.** A sheet holding two
   dropdowns would open a sheet over a sheet (the Maker has ONE bottom sheet; the pop-up rule
   is one open at a time), and inline the sample stays above the cards while they are
   tapped. The brief words it the same way ("Under the carousel: How much ▾ and Colour ▾").
2. **Blur and Parallax were not regrouped** under "The picture" (the note's PR 3a) — Blur
   stays its own row where it is; Parallax is not offered in the Studio today. Not asked for
   in this brief; said so it is not read as done.
3. **Nothing stored + an effect = "the page's own background" is written with it**
   (`{ ground: 'theme' }`, which draws exactly what "nothing" draws). Consequence: it is a
   choice, so a cover photo added LATER no longer becomes the background by itself. The
   note's decision 2 recommends that default anyway; flagged for the owner.
4. A tried effect's card says "· trying" after its name (the builder's word — the gallery
   draws no mark for it).
5. The miniature's ground is the sample's measure, so for one frame after the tab opens the
   cards show the background without the shapes.

NOT SEEN in a browser at commit time (no server of my own): the strip, the rows and the
note in the real Maker. Rendered to HTML in the guard; to be looked at on the review copy.

SPEC IMPACT: None beyond the contract above.

## 2026-10-08 · feat(look): the guest's Event Hub wears the effect — by the sample screen's own answer (amendment PR 3, step 4)

Local commit. Seen on the review copy before this step (steps 2–3 merged): the carousel, the
rows and the Pro note work as built; ◆ shows in the lab; ms/frame on the real sample screen
at Lavish — 8.3 mean / 9.3 p95 for every effect, the same as no effect (one 58 ms frame in
354 during petals, on a Mac shared by three builders). A headless browser's 120 Hz clock:
the page's thread stays free; a real phone's GPU is slower and is not measured by this.

- **The guest page** (`app/[slug]/_lib/main-ground-layer.tsx`): `mainGroundLayerFor` is now
  ONE way out — the background as it was always resolved (`mainGroundOf`, its code untouched
  and naming no effect), then `effectOver`: the effect stored on the main background, laid
  over it by the one layer (`fixed inset-0 -z-10`, after the background in the page — over
  its veil, under the words). On EVERY background: a picture, a film, a pattern, a plain
  colour, and the page's own ground. It also reaches the RSVP page, whose background follows
  the Event Hub's (the same function).
- **The same answer as the sample:** `lookSampleEffect(effect, lookEffectOn(…))` — the sample
  asks it of the drafted row, the guest page of the event's own six look columns
  (`lookRowOf`). What the effect lies on is measured from what the page's own rules already
  measure: the picture's colours under its Fade veil or paper scrim, a blend's ramp, or the
  page colour (the couple's own, Candlelight included). `shown` is the background as REALLY
  drawn for this viewer (null where the page falls back to its own ground).
- **◆ for guests:** a Pro effect is drawn only while the event owns Event Hub Pro (asked only
  when a Pro effect is stored — the request's cached read), and on the host's own canvas as
  it would look. A free effect asks nothing.
- **It wears the couple's colours only** — the engine and the layer name none of the app's
  (`the-accent-is-one-token` walks `app/[slug]`; a line in this guard too).
- Zero client JavaScript and zero requests added to a guest's page: the layer is HTML and
  one inline stylesheet, drawn only where an effect is on.

Requests per guest-page render (read from the loader, not counted with a stub): no effect —
unchanged; a free effect — +0; a Pro effect — the event's Pro, which the theme gate and the
watermark already ask in the same request (cached), so +0 where they ran.

Guard: `the-look-sample-is-the-guest-look` (+3 tests, 10 in all): (7) over one row in
nineteen of the 4,200-look sweep × ten backgrounds × three effects, what the guest page
measures (nothing in hand) equals what the sample measures (its own scope and veil handed
in), and both draw the engine's own spec; the ground follows a dark page colour, a blend's
whole ramp, Candlelight and a Fade; (7b) the guest file's one way out, the Pro gate before
the effect is worked out, the same six columns; (7c) one engine call for the page, one
layer for everyone, nothing of the app's colour. 19 sabotages: 18 red; ONE WAS MINE — it
put a comment where the guard strips comments, so it changed nothing; re-aimed as code, red.
`the-main-background-offers-every-choice` and `the-background-has-one-source` pin the
background's own returns — the first draft of this step wrapped each return and both went
red; the wrapper leaves those lines exactly as they were (no guard re-aimed).

NOT SEEN in a browser at commit time: the effect on a guest page (the lab's guest page asks
this same function with the lab's saved background — to be looked at once merged). Edge,
said plainly: the sample measures the couple's own page colour as if Event Hub Pro were on
(it is the host's try-on); a guest of an event WITHOUT Pro sees the theme's paper, so there
a picked colour may be pulled against a slightly different ground than the sample showed.

SPEC IMPACT: None beyond the contract above.
