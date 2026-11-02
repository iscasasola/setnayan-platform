## 2026-10-10 · feat(maker): Your seat gets a real Background and Animate

The Maker's phone toolbar greyed Background and Animate on six blocks the canvas draws as SAMPLES, because a look
kept for a sample would have shown in the Maker and never reached a guest. This makes the first of them real.

**Your seat** (`f:find_your_seat`)

- The look is kept against each guest's REAL block — `YourSeatBlock`, drawn from one const (`seatBlock`) in
  `app/[slug]/_components/site-body.tsx`, on Welcome or inside Me, never both. The block's hidden mark rides with
  it, right before its root, and is served only when a look is kept (a guest's page with none is unchanged, byte for
  byte).
- The Maker's sample stands behind the same mark, so the same rules draw the look there. To make that true the
  sample now wears what the real block wears: the Map's sample sits on the hub's plate (the real Map is a plate),
  and the Place card's sample is on paper (the real place card is). The Table number is bare in both.
- Animate — the same rows as the four fixed blocks (`BlockAnimateRows`).
- Background — None · Plain · Frosted, on the block's ONE card: the plate itself (Map), the place card inside
  (Place card), or the block's own root where it has no card (Table number). Nothing kept = today's look, and
  today's tile is shown picked.
- A block drawn inside Me has no chapter round it, and the page's one observer marks chapters and scenes only — so
  a timed Build in is also bound where the block has no chapter (it plays as Me is opened). Without that the
  effect would have been seen in the Maker and never by a guest.
- Nothing added to the Maker's first load: `lib/block-looks.ts` and the toolbar are fetched on demand, and
  `lib/maker-parts.ts` is not edited (the part rule still says "no"; the two tools are the block's own).

- The Map's sample shapes are tinted from the words' own colour (`currentColor`): on the hub's plate the `ink`
  utilities draw nothing (the plate's `--color-ink` names itself), and with `bg-ink/…` the six tables vanished the
  moment the sample stood on its plate (seen in the Maker lab).

Guards: `apps/web/lib/a-fixed-block-has-its-own-motion.test.ts` and
`apps/web/lib/a-fixed-block-has-its-own-background.test.ts` — the list, the rules, the markup each ground leans on
(the real block's and the sample's), the mark's two slots, the Apply count. New:
`apps/web/lib/a-sample-block-look-reaches-the-real-page.test.ts` draws the REAL guest page (`SiteBody`, through
`lib/site-body-fixture-render.ts`) for a guest with a table: nothing kept is the same bytes; a look kept adds exactly
the hidden mark right before the seat's own root and the one style — and not one other byte. Three pins re-aimed, each
with its reason (`every-stages-tab-has-its-own-page`, `the-day-parts-are-in-the-maker`, `site-body-fixture-render`).

SPEC IMPACT: new key `find_your_seat` under `events.style_preferences.block_looks` (`{ motion?, g? }`, the same
shape as the four fixed blocks'; no migration). `BLOCK_SAMPLE_WHY` now lists five samples.

## 2026-10-10 · feat(maker): the Digital pass gets a real Background and Animate

**Digital pass** (`f:pass`)

- The look is kept against each guest's REAL ticket — `GuestTicket`, first on Me. The ticket is mounted by the page
  (`app/[slug]/page.tsx`), so the block's hidden mark is made there, by the same rule as every block's (the Maker's
  canvas always; a guest only when a look is kept), and handed to the ticket, which puts it right before its own root
  — and only when it draws a TICKET. A guest who has not replied sees the reply button there and one who cannot come
  sees one line: neither is a pass, and neither is dressed or moved.
- The Maker's sample of the pass stands behind the same mark (the block's mark, the Maker's marker, the sample), so
  the same rules draw the look in the Maker.
- Animate — the same rows as the other blocks. The pass is Me's, so its timed Build in is bound where there is no
  chapter (it plays as Me is opened).
- ⚓ The door's own lift stays: when the day's "Show your ticket" lands on the pass (`#site-pass`),
  `[data-motion='pass']:target` still lifts it. A block's motion would out-rank that rule, so the pass's is written
  for every moment but that one (`:not(:target)`).
- Background — None · Plain · Frosted. The pass is bare today (None is shown picked): Plain and Frosted put the hub's
  paper or the glass BEHIND the ticket, on the block's own root. The ticket's picture is a PNG drawn on the server; a
  Background never re-draws it.
- Nothing added to the Maker's first load.

**Photos of you** (`f:photos_of_you`) — NOT made live; it stays a sample, with its reason line unchanged. Its real
block is one root, but that root is the gallery's dark "obsidian" card (`.sn-gal`), whose words are light-on-dark by
its own tokens (`--sn-ob-*`). None and Frosted would take the dark ground away and leave those words on the page's
light ground or on white glass, where the same file measures them unreadable — and the lab cannot draw a guest's real
gallery to check any re-inking. Left for a design ruling.

SPEC IMPACT: new key `pass` under `events.style_preferences.block_looks` (`{ motion?, g? }`; no migration).
`BLOCK_SAMPLE_WHY` now lists four samples (Photos of you · Announcements · Live hub · What to wear).
