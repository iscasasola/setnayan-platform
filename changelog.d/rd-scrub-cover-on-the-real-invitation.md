## 2026-10-10 · feat(scrub): the cover's hand-over on the real invitation page (ships dark)

"Scrub out" still ships DARK (`lib/scrub-out-offered.ts` `SCRUB_OUT_OFFERED = false`): nothing here changes any
guest's page until that constant is turned on, which is the owner's go. LOCAL branch
`rd/scrub-cover-on-the-real-invitation`, on top of `rd/site-body-fixture-render`.

- **A guard first** (`lib/site-body-fixture-render.test.ts` (6)): on the fixture render of the REAL guest page, a
  cover stored to leave by Scrub is today's page byte for byte and mounts no island while Scrub is dark.
- **The engine finds what follows the cover in the page's LATER groups** (`hub-scrub-engine.ts` `followers`). On the
  real invitation the cover shares the page's first group with the reply card and everything else is in later
  groups, outside the cover's own rest-of-the-page box; the walk stopped at that box, so the next group stood over
  the cover while it was leaving. It now goes on up to the page's own stage, the rise is said on that stage
  (`--hub-zrise`), and the stylesheet's rule for a lifted box no longer asks for it to be inside `.hub-cover-after`.
  A group that is not shown (another tab) and a box the page pins itself are left alone.
- **A page a tab**: the cover is watched for a size of its own, so a page armed on another tab measures the cover's
  hand-over the moment the first tab is shown (no reload). The observer no longer skips "its first call" by a flag
  (the specification gives a box with no size no first call; Chromium gives one anyway — probed): each box's height
  is remembered and only a height that differs is measured again.
- **Proof** (`scripts/scrub-check-page.tsx` `cover-groups…`, `scripts/scrub-browser-check.mjs` block 15, Chromium):
  a generated page in the real invitation's shape — an article of groups, the cover and one block in the first, a
  hidden group, a pinned pill, a greeting, the scenes, the foot — at four sizes, and the tab case. `SCRUB_ONLY=15`
  plays one numbered block alone.

- **The invitation's GUEST tree hands its cover over** (`site-body.tsx`, the two `PahinaMasthead` branches of
  `plan.body === 'normal' && plan.heroShouldRender`, through `HubCoverHold`). The masthead goes in the cover's box and
  the rest of its group — the reply card, or the one action — in the rest box, so the reply card is what arrives where
  the cover leaves; the page's later groups are held under it. On a page a tab the hand-over is on the first tab only.
  No page pair is added: the hero row was already counted. A cover that does not leave is returned as given — the
  committed golden of the fixture page is untouched. The stranger's tree and Save the Date are not wired.
- `HubCoverHold` takes `boxes`: what the PAGE needs said on the three boxes so the wrapped page is still the page —
  here the cell marked the first screen (never hidden by the scroll reveal), the two inner boxes chapters boxes (the
  masthead and the reply row are watched as before), and the 3rem rhythm on the rest box (`mt-12 space-y-12`).
- Stylesheet: an arrival that is one of the page's chapters keeps the hand-over's one fade (the scroll reveal's
  "shown" rule would otherwise draw it at opacity 1 the moment it appeared).
- Engine: once a cover's hold is over, what follows it stands where the page laid it out to the pixel (at some
  window heights it stopped a rounding short: 1.5 px on the real page at 1280 × 770).
- Island: a page whose cover is its only Scrub says why it is off ("the opening is still up", "editing…") on its own
  hold — it has no scenes block to say it on.
- **Proof on the real page's markup** (`scripts/scrub-fixture-page.tsx` + block 16 of the browser check): the fixture
  invitation drawn by the real `SiteBody`, with the app's stylesheet compiled for it. Wrapped and with no script,
  every one of today's 310 boxes stands where it stood (cover → reply row 48 px → 48 px; reply row → next group
  48 px → 48 px), and the scroll reveal's chapters in the first group are the same three plus the cell.

- **TOGETHER** (owner 2026-10-10, asked what should stand where the names built out — the RSVP button alone, or
  the button and the countdown: *"Together."*). When what arrives after the cover is the page's ACTION ROW, the block
  after it arrives WITH it — one fade, one unit, centred as one, the page's own distance between them (48 px) kept.
  Decided by what the block IS, never by its height: the engine keys on the marks the page's rows already carry —
  `data-arrival-action` (the reply row, and the row that stands in its place) and `data-get-inside` (the stranger's
  door). On the real guest page: the RSVP button and "Until we say 'I do'". A long second block makes a long unit —
  the ordinary long arrival: from the top of the room down, then scrolled through; never shrunk or clipped.
- **The cover never fades to nothing.** When the cover's group holds nothing after the cover (a guest the page has
  no action for; a cover that is the last thing in its group), the next block on the page arrives, alone, and the
  box that holds it is the one pulled up to the cover (`data-hub-zrest`).
- The owner's numbers are untouched (55 % · enters at 80 % · runs 22 % · held where it stands).
- Proof: block 17 of the browser check (generated pages: the pair, the long second block, nothing after the cover)
  and block 16 on the real guest page at 375×812, 375×667, 441×882 and 1280×770.

- **The STRANGER'S tree hands its cover over too** (`site-body.tsx` `anonymousTree`, its two masthead call sites,
  through `HubCoverHold`), with the same rule: there the DOOR ("Get inside") is the action row and the Countdown
  arrives with it. The text-only cover sits in its first-screen wrapper with the door in the rest box; the photo
  cover is the last thing in the page's first group, so the door's group is the box the engine pulls up to it.
  A cover that does not leave is drawn as before: the stranger's page has its own golden now
  (`lib/site-body-fixture-stranger.golden.html`, `fixtureStranger()`), untouched by the wiring.
- Stylesheet: a chapter that HOLDS what arrives is shown at once (the scroll reveal would otherwise hide the
  stranger's Countdown, or slide it 22 px under the hand-over's own fade); and a page whose cover is its only Scrub
  can lengthen its end on the page's own hold (a tall photo cover on a short first tab ended 16 px before the
  hand-over could).
- Save the Date is NOT wired: its cover is the film, with a walker of its own — it needs its own design.

## 2026-10-12 · fix(scrub): the first-screen fit stands aside while the cover hands over (ships dark)

- **A loop, found and closed.** On a short screen main's first-screen fit (`first-screen-door.tsx`: the stranger's
  cover makes room for "Get inside") and the wrapped cover answered each other: the fit shrank the cover, the
  hand-over re-measured and moved the door (which is the ARRIVAL under the wrap, not in the cover's flow), the fit
  took its plan back, and again — the page changed length every ~120 ms at 375×560, 375×600 and 320×568 (Chromium).
  While the page's hold is armed (`data-hub-page-on`) the fit now writes nothing and takes any plan back; it watches
  the arming, and fits exactly as before whenever the hold is off (reduce motion, the Reveal up, Scrub not offered —
  every page today: the mark never exists while "Scrub out" is dark). Source pin in
  `app/_components/the-first-screen-keeps-its-action.test.ts`.
- **Browser check (block 16)**: the touch drag now tests its claim (a slow drag that rests before it lifts, inside the
  hold; the travel IS the Build out, by the page's number and by the drawn fade; React's own root delegation read
  apart, and only a non-passive touchstart/touchmove/wheel counts as able to hold a finger back). New rows: the fit
  mounted on the check's pages (`scripts/scrub-check-door.tsx`) — today's fitted page, the wrapped page (the fit stands
  aside and the page stays still), and the wrapped page under reduce motion (today's fitted page, box for box); and
  "the cover's names are never under the pinned top bar while it is held" — RED at 375×667 (guest and stranger) and
  for the stranger's photo cover: a cover taller than the room is held by the ordinary rule, its bottom on the centre
  line. Left for the owner (likely his "heading clipped at the top on iPhone").
- Switch off proven: the real `SiteBody`, 24 viewer × stored-page cases, byte-identical to origin/main, no island.
- Save the Date is still not wired.

⚠ Chromium only. Nothing here has run on iOS Safari (WebKit).

SPEC IMPACT: None (the owner's rulings in `Maker_Animate_Preview_Scrub_LOCKED_2026-10-09.md` are unchanged; no
number of his is touched).
