## 2026-10-10 · feat(maker): Background for the four fixed blocks — None · Plain · Frosted

Owner (2026-10-09, verbatim): *"there should always be animate and background?"* → *"yes that is what we are doing.
giving the freedom to fix their event hub."* Animate reached the four fixed blocks a guest really sees on 2026-10-10;
this gives them **Background**, on the phone toolbar, with the RSVP card's own three tiles.

**What a couple sees.** Pick the Wedding March, The details, E-Gifts or Happening now on the canvas → **Background** is
live → one row of three tiles (None · Plain · Frosted, the ring on the picked one) and one sentence under them:
*"Behind this block is the Look’s background — the same one every page wears."* A tap shows on the canvas at once,
goes to the draft, and is live on Apply (it counts as one change — "How a block looks").

**Where the ground lands — one card, never two.**

| Block | Today (shown picked, stores nothing) | None | Plain | Frosted |
|---|---|---|---|---|
| Wedding March | None — it stands bare | today | the block takes the hub's paper (the plate's own paper, edge, room and ink) | the block takes the glass |
| The details (its plate) | Plain | the plate goes bare, its printed inner frame with it | today | the plate turns to glass, no inner frame |
| The details (Big date · Card) | None | today | the block takes the paper | the block takes the glass |
| E-Gifts | Plain | the door goes bare | today | the door turns to glass |
| Happening now (both places) | Plain | the card goes bare | today | the card turns to glass |

Nothing is ever put ROUND a block that already has a card. E-Gifts with no gift details stays grey (*"Guests see
nothing here until you add your gift details."*), and the six sample blocks stay grey exactly as they were.

**How.**

- `lib/block-looks.ts` — one more key beside `motion`: `g: 'none' | 'plain' | 'frost'`, read by the one strict reader
  (a value off the list, or the one a block wears anyway, is dropped) and written by `blockLooksWithGround`. The rules
  are fixed strings on fixed selectors (the block from its hidden mark; its plate; its door) — the two grounds are the
  RSVP card's, word for word, and they sit OUTSIDE the motion's gates (a background is not a movement).
- `stage-panel/block-background.tsx` (new) — the tiles, in the toolbar's four-row frame. It shares Animate's one save
  (`useBlockLooksDraft`, lifted out of `block-animate.tsx` unchanged) through the work area's draft door.
- `stage-tools.tsx` — `ownTool` names Background beside Animate for a block; its rows are the toolbar's own.
- A guest's page is untouched: no new wrapper, no new attribute, `site-body.tsx` and `editor-bridge.tsx` are
  byte-identical. With nothing kept there is no mark and no `<style>`, as before.
- First load: nothing added. The seven first-load files and `details-lazy.tsx` are byte-identical; the rows are
  imported by the toolbar, which is fetched on demand.

- The Maker lab (`app/dev/maker-lab/guest/page.tsx`, dev only): the March's and E-Gifts' marks now stand right BEFORE
  the real block, inside the lab's own wrapper (a ground dressed the lab's padding and missed the door), and The Day's
  canvas carries the blocks' `<style>` (it had the March's mark and no style, so a look picked there drew nothing).

**Two things measured on the way (Chromium, the Maker lab, 2026-10-10).** The plate's own two ink lines could not be
copied onto a bare block: `--color-ink:var(--color-ink-on-plate, var(--color-ink))` names itself, the engine drops it,
and the edge beside it computed to no border at all — so the paper reads the ink once into `--block-ink` and hands it
to what is inside the block. And the plate has no edge of its own to recolour, so a card that turns to glass is given
its one-pixel edge outright (the glass's fill alone cannot be seen on a light page).

Guard: `apps/web/lib/a-fixed-block-has-its-own-background.test.ts` (8 tests; 16 sabotages seen red, in its header). Two pins
in `a-fixed-block-has-its-own-motion.test.ts` re-aimed with the reason written in (`ownTool`, the empty E-Gifts line).

SPEC IMPACT: new key `g` (`'none' | 'plain' | 'frost'`) under `events.style_preferences.block_looks[<block>]`, beside
`motion`, for `entourage` · `details` · `gifts` · `spotlight`. No migration (the column is free-form jsonb). Corpus not
edited from this local-only branch — to be recorded when the branch is merged.
