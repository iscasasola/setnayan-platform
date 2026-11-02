## 2026-10-09 · fix(scrub): the top of the room is one number, the stylesheet's — a long arrival no longer begins under the progress mark

The Scrub engine (`app/[slug]/_components/hub-scrub-engine.ts`) kept its own "top of the room" — 76 px, or 9 % of
the window — while the stylesheet's line (`--hub-pin`, `app/globals.css`) is 100 px on a page with the invitation's
pinned top bar. Measured in Chromium on a page with that bar, a list handing over to a second long list: the
arrival's top stood at 75.6 px (375 × 812), 76.1 (375 × 667), 79.0 (441 × 882) and 75.8 (1280 × 770), against a line
of 100 px, a bar that ends at 65 px and a progress mark that ends at 88 px — so the arrival's first line was 9 to
12 px under the progress mark. Now 99.6 – 100.1 px at all four.

- ONE SOURCE: `--hub-pin`. The armed scenes block carries it as a length (`scroll-padding-top`, on a box that does
  not scroll — it moves and paints nothing) and the engine reads that back in pixels. The engine has no number of its
  own, and a page that does not say its line is not played (it says why, like every other "off").
- The two `--hub-pin` declarations moved OUT of `@supports (animation-timeline: view())` into the plain base, values
  unchanged. Scrub does not need scroll timelines; a browser without them (Safari before 26) would otherwise have no
  line at all. An Auto run reads the same property as before.
- The owner's numbers are untouched (Build out 55 %, the arrival enters at 80 % and runs 22 %, rest 30 %, Held =
  Centred). `SCRUB_OUT_OFFERED` stays `false`.
- Browser check (`scripts/scrub-browser-check.mjs`): a new page (`scrub-check-page.tsx` `bar`) and case 12 — the
  arrival stands ON the stylesheet's line and clear of the bar and the progress mark, at 375 × 812, 375 × 667,
  441 × 882 and 1280 × 770. Unit guard: `lib/scrub-is-a-held-hand-over.test.ts` (9).

NOT WHAT THE iPHONE RECORDING SHOWS. The lab page the owner recorded (`/dev/maker-lab/guest/scrub`) has no pinned top
bar and no list-to-long-list hand-over, so both numbers were already the same there (76 px) and this change moves
nothing on it: measured before and after, the Schedule arrives with its top at 343.7 px (375 × 812) and its heading
is where plain scrolling puts it while row 4 builds — identical to the decimal. In the recording the heading is cut
because the list is being scrolled THROUGH (each row builds as it reaches the centre line, so by row 4 the heading
is most of half a screen above it and passes under the progress mark). That is the approved behaviour ("as you scrub
it scrolls to show the other parts"); keeping a list's heading in view while its rows build would be a new rule and
is not built.

Chromium only. Nothing here was run on iOS Safari.

SPEC IMPACT: None.

## 2026-10-09 · fix(scrub): the card rule reaches a scene inside a frame that paints nothing

A scene the couple arranged in any way is drawn inside a frame (`hub-canvas-frame.tsx`), and the hub's one card rule
(`app/globals.css`, "THE HUB IS CARDS") only matched a section that was its wrapper's direct child. So a scene given
nothing but a motion setting lost its card and stood as bare words on the page. The rule gains one arm:

`:is(.sn-hub-cards, .hub-scene) > .hub-canvas.hub-no-media:not(.hub-bg-none):not(.hub-has-tpl) > .hub-canvas-body > section`

- `hub-no-media` is the frame's own word for "paints nothing". The card is then the scene's, exactly as with no frame
  at all — the rule the widgets that draw their own card already follow (`lib/hub-canvas.ts` `hubBackgroundOwnsBox`).
- NOT "No background" (`hub-bg-none`: no box, on purpose). Not a scene with a ground of its own (that frame is the
  box and is not `hub-no-media`). Not a template scene (`hub-has-tpl`): those have never had a card and keep their
  own layout — left exactly as they are.
- THIS CHANGES HOW EXISTING SCENES LOOK FOR GUESTS. Every scene that is (a) drawn in a frame — anything stored on its
  canvas: a Build in / Build out / Movement, "one part after another", a Style, a palette look, one part's font or
  colour, a way of leaving — and (b) has no background of its own, gets the hub's card back: paper, a hairline,
  14 px corners, the soft shadow, 18 px of room. A scene nobody arranged, "No background", a coloured / glass /
  photo / clip ground and a template scene look exactly as before.
- The lab (`app/dev/maker-lab/guest/page.tsx`) drops its stand-in cards: the chain's cards are now the hub's own
  rule, so what is seen there is what a guest's page draws.
- Browser check case 13, through the REAL frame (`scrub-check-page.tsx` `cards`): the motion-only scene wears the
  same card as the scene nobody arranged; "No background", a coloured scene and a template scene do not; on the Scrub
  page every framed scene is a card. Guards: `the-hub-is-cards.test.ts`, `the-lab-plays-the-scrub-chain.test.ts` (3).

Noticed, not changed: on a page with an Auto run or a Scrub hand-over, a scene with ONLY a Spacing choice sits in a
plain spacing box (`.hub-scene > div > section`), which no arm of the rule matches there (off such a page
`.sn-hub-cards > div > section` does). And "Words only" with a photo still chosen paints nothing, so it is a card by
this arm while the widgets' own rule (`hubBackgroundOwnsBox`) calls that scene bare — a corner worth one look.

Chromium only. Nothing here was run on iOS Safari.

SPEC IMPACT: None.
