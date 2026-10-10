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

⚠ Chromium only. Nothing here has run on iOS Safari (WebKit).

SPEC IMPACT: None (the owner's rulings in `Maker_Animate_Preview_Scrub_LOCKED_2026-10-09.md` are unchanged; no
number of his is touched).
