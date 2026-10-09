## 2026-10-10 · feat(scrub): the cover is hand-over zero — held where it stands, and what comes next arrives in its place

The owner's own example ("maria jose must build out and until we say i do should be where maria jose build out") was
the one hand-over the page could not draw: the cover is not a scene of any scenes block. Built for the LAB and the
generated check pages; no real guest page draws it yet, and `SCRUB_OUT_OFFERED` stays `false`.

- THE HOLD LINE (`hub-scrub-math.ts` `scrubPair`'s `stands`). "Held = Centred" is a place a cover cannot be scrolled
  to — measured before this change, a scene at the top of the page was shoved 326 px down the screen as the page
  opened and drawn 73 % built out before a touch. The cover, and only the cover, is held WHERE IT STANDS WHEN THE PAGE
  OPENS: at scroll 0 nothing has moved and nothing has begun. The owner's numbers are unchanged (Build out over 55 %
  of a screen; the arrival enters at 80 % and runs 22 %; rest 30 %); every other hand-over is still Held = Centred.
  A cover that cannot be seen whole from where it stands (taller than the screen) keeps the ordinary rule: scrolled
  through, held with its bottom on the centre line.
- WHAT ARRIVES is whatever comes next on the page — a scene, or any block (the door, a greeting, the ticket): the
  next box with a size, at the usual centred line, never above the cover or the top of the room. What follows it
  stays under the cover until the cover has completely gone. A box the page pins or places itself is never moved.
- THE NEST (`hub-scenes.tsx` `HubCoverHold`): the cover in one plain box, the rest of the page in another; the
  page's own first pair stands still for it (`HubPageHold` — `hubScrubHoldsAtMost` already counted the hero row).
  A cover that does not leave returns the cover and the rest AS GIVEN: no box, no class, no island — every page
  today. `hubCoverLeaves` asks the hero row the two questions a scene is asked, through the same dark door.
- HOW IT LEAVES: the hand-over's one fade — the default Build out a Scrub scene gets when none is chosen (the "Calm"
  preset: Fade). Stored where "Scene leaves ◆" on any cover part already writes it: `transition` on the hero row's
  canvas. No migration; no line changed in `stage-tools.tsx` or `lib/maker-parts.ts`.
- ENGINE: a stage can no longer stick before the hand-over before it has let go (it is held where it arrived). Seen
  as a countdown that stood the page still 80 px early after a tall cover, and as half a pixel that moved the whole
  page at scroll 0 at two window sizes. The top line is also carried by the cover's own cell, for a page whose cover
  is its only Scrub; the island is mounted by `HubCoverHold` there.
- LAB: `/dev/maker-lab/guest/scrub` hands its cover over from the start (`LAB_SCRUB_COVER`); the greeting is what
  arrives. The first card no longer says the cover is not part of the chain.
- PROOF: `scrub-browser-check.mjs` case 14, 59 new checks — 283 green in Chromium. At 375 × 812, 375 × 667,
  441 × 882, 890 × 1548 and 1280 × 770: at scroll 0 the cover is exactly where today's page has it, whole, 0 % out;
  the page stands still; the Build out completes over 55 % of a screen; the next thing enters at the last 20 %, on
  the centred line; back == down; the scenes after it still hand over; no script → the plain page. Also: a block
  after the cover, a cover that is the page's only Scrub, a cover taller than the screen. Unit guard (10), with two
  sabotages (the hold line ignored; the boxes drawn for a cover that does not leave) and one in the browser (21 red).

NOT BUILT: the real guest page (`site-body.tsx` — the cover and what follows it sit in different tab groups there),
the Save the Date's own cover, a Build out of the cover's own choosing, and the lab badge's count (it does not name
hand-over zero).

Chromium only. Nothing here was run on iOS Safari.

SPEC IMPACT: None.

## 2026-10-10 · feat(scrub): under a closed Reveal nothing is held — the cover's hand-over waits for the opening to go

The cover's hold begins at the very top of the page, and the Reveal lies over that first screen without stopping
the page from scrolling under it: a guest who moved the page before opening it would have played the cover's Build
out unseen, and opened onto a cover already gone.

- `reveal/reveal-overlay.tsx` says it is up ON THE PAGE (`data-reveal-up` on `<html>`), written in the one effect
  that measures "a guest is looking at the opening" and taken off with it. It draws and styles nothing.
- `hub-scrub.tsx` (the island): on a page whose cover hands over, the hand-overs do not arm while that mark is on, and
  arm the moment it comes off; the page says why ("the opening is still up"). A page whose cover does not hand over
  never looks at the mark — nothing changes for any page today.
- PROOF: three new checks in case 14 (a page armed by its own island, the mark on before it mounts) — 286 green in
  Chromium. Guard: `the-lab-plays-the-scrub-chain.test.ts` (4). Sabotage: the Reveal not asked → red in the unit
  guard and twice in the browser; restored.
- NOT PLAYED WITH A REAL REVEAL: the lab has none, and no real page draws the cover's hand-over yet. The check sets
  the mark by hand, as the overlay would.

Chromium only. Nothing here was run on iOS Safari.

SPEC IMPACT: None.

## 2026-10-10 · fix(scrub): the cover's hand-over reads its distance back, and the lab badge names hand-over zero

- A cover whose last line has a bottom margin: the margin runs out through the cover's box and is ADDED to the
  distance the engine sets, when what arrives is drawn over the cover — measured, the arrival stood 40 px below its
  line (445.6 against 406 at 375 × 812). The engine now reads the distance back as it was laid out and takes off what
  is over (`hub-scrub-engine.ts`). Under a short cover the larger margin simply wins and nothing was wrong — which is
  why the first version of the check page could not show the fault; the page now has a cover the arrival overlaps.
- The lab badge (`app/dev/maker-lab/guest/scrub-badge.tsx`) counts and names hand-over zero: "hand-over 1 of 4 · The
  cover leaves 50 % · Countdown arrives 0 %". It said "next to leave: Countdown" while the cover was leaving.
- PROOF: three new checks in case 14 — 289 green in Chromium. Sabotage: the read-back removed → red at both sizes;
  restored. Guard (10) holds the line.

Chromium only. Nothing here was run on iOS Safari.

SPEC IMPACT: None.
