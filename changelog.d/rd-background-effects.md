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
