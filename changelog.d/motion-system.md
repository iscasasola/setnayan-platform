## 2026-11-14 · feat(motion): the approved motion system, in the shared pieces and tokens — one place each

Owner, 13 Nov 2026 (DECISION_LOG "Motion system approved": *"motion approved"*; prototype
`prototypes/approved_2026-11-13/grow-full-screen-fable.html`, artifact CnEGqnNxRH9QcTsbgrFHNC v1) + the same day's
"Speed + motion target" (jank / flash / jump are bugs). Built into the SHARED pieces only, so every page that uses them
gets it with no per-page edit:

- **Tokens** — the timing table is one block in `globals.css`, extending the existing `--sn-dur-*` / `--sn-ease*` set
  (a guard forbids a second token family): press 100 · release 280 · grow-press 120 · open 360 · close = open × .8 ·
  step 40 · row 320 / 260 · toggle 260 · chip 220 / 180 · field 260 · snap 220 · reduced fade 120, and
  `--sn-ease-emph` `cubic-bezier(.2,0,0,1)`. The 0.7 s press family (`--sn-pill-dur`) now reads the release; the 0.7 s
  rise (`--sn-dur-rise`, `RISE_MS`) now reads the 360 ms open — the ruling says the faster numbers REPLACE both.
  `lib/grow-motion.ts` mirrors the table for script (held equal by a test) and holds the one grow player.
- **Buttons / rows (PressFeel)** — in on touch-down (100 ms ease-out to .97; a row, ≥ 300 px, to .985) with a
  pushed-in shade, HELD while the finger is down, out on lift (280 ms house spring). Reduced motion: the shade only.
- **Rise full screen (RiseScreen)** — grows out of the pressed thing: the clip on one layer in 360 ms, the page behind
  steps back to .96 under a dim, the pressed thing's words travel to the title, content in three steps 40 ms apart,
  ✕ / ⓘ and the thumb bar last; ✕ / Esc / Back play the mirror at 80 %. Two lines changed in `rise-screen.tsx`.
- **Sheet** — grows out of the pressed button (moved onto its box and clipped to it, into place unclipped), head /
  first block / rest in three steps, ✕ and foot last, the dark fading with the shape; closing plays the mirror at 80 %
  and only then leaves the page (it keeps showing what it showed, so a caller that clears its item never empties it
  mid-close). No fresh press behind it → it simply appears / leaves, as before.
- **Rows (Fold)** — still one open at a time (`useOneOpen`); now 320 ms open / 260 shut on grid rows, emphasized, the
  arrow with it, and the content in three steps 40 ms apart (`fold.css`). Reduced motion: at once + 120 ms fade.
- **Toggle / chip / field / swipe** — `.sn-switch` 260 ms (knob on the spring), `.sn-chip` 220 in / 180 out,
  `.input-field` focus line 260 ms, a swiped row snaps back in 220 ms — all emphasized, all from the tokens.
- **Guard** — `lib/the-motion-system-is-shared.test.ts` (sabotaged four ways, each red). `lib/the-rise-is-0-7s.test.ts`
  is retired (its ruling was superseded); its "nobody keeps their own copy" scan moved into the new guard. Ten older
  guards that pinned 700 ms were updated to the new tokens, nothing loosened.
- **Lab** — `/dev/motion-lab` (dev-only, never built for production) draws the real pieces; measured at 390 and 1280:
  press .97 held, shade on/off; sheet mid-grow clip+translate, open with no animation left; rise mid-grow page at .97 +
  dim, chrome still hidden; close ≈ 0.5 s; one row open at a time; no layout shift without input. Shots in
  `build-sessions/shots-motion-system/`.

Not touched (open template / rise PRs own them): `picked/picked-shell.tsx` (reads `RISE_MS`, so it is faster now; its
own close is not yet the mirror at 80 %), the per-page sheets in #7595 / #7632 / #7663, `template-rows.tsx`,
`setup-offer-fold.tsx`. No new colour, no migration, no server action.

SPEC IMPACT: None — implements the approved 2026-11-13 rows as drawn; the 0.7 s rulings (8 Oct press family, 10 Nov
rise) were already superseded by that row.
