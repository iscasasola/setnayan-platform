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
