## 2026-08-21 · feat(nav): the sidebar moves when it changes shape

Owner: *"on the sidebar. when something add/ expands/collapses, we want it to
animate properly."*

`front-door.css` carried exactly **one** transition in 1970 lines — the top
bar's hide-on-scroll — so every other change the shared rail makes was a jump
cut. Three moments, all now animated, in the ONE rail every signed-in tree and
every public doorway mounts (`front-door-shell.tsx`):

- **"Show more" / "Show fewer"** — the nine extra marketplace categories unfold
  and fold on `grid-template-rows: 0fr ⇄ 1fr`, landing exactly on their own
  height. Measured live: `0 → 132 → 270 → 374 → 394 → 396px`, and 396px is
  nine 44px rows.
- **A group that arrives** — the context group ("you are in this wedding, here
  are its sections") and the two front-page groups it displaces (Browse by
  category · Studio) fade and settle in. One wrapper in the shell covers the
  event, vendor and admin rails at once.
- **The phone drawer** — slides in and, for the first time, slides *out*, with
  the scrim fading alongside it instead of blinking away a step ahead.

**Why the route transition was never going to cover this:** globals.css freezes
the chrome during a navigation on purpose
(`::view-transition-old(root)/-new(root){animation:none}`) so the page slides
and the rail holds still. That is correct and untouched — and it is exactly why
the rail's own changes have to carry their own motion. Beside a page that
slides, a rail that snaps reads as a glitch rather than as calm.

**Two things this change refuses to pay for:**

- `display: none` still means *shut* on the drawer. It cannot be transitioned,
  so the closing half is a real third state (`true → closing → false`) that
  holds the element for one animation — never the off-screen-transform trick,
  which would leave a dozen focusable links reachable by Tab behind the scrim.
- The reveal panel goes `visibility: hidden` at the end of its collapse. A
  clipped row is still focusable; without it, Tab walks a keyboard visitor
  through nine invisible category links behind a button that says "Show more".

Every duration and curve reads `--sn-dur-*` / `--sn-ease*` (globals.css §
motion) — a guard fails if one is typed in. The drawer's two halves (a CSS
animation and the `setTimeout` that removes the element) share ONE number,
handed to the stylesheet as `--fd-drawer-ms`, so they cannot drift into a
drawer that vanishes mid-slide or hangs half-open.

`the-rail-moves.test.ts` — 8 assertions, every one mutation-checked by
occurrence count (18 mutations; 16 landed and turned the suite red, 2 were
re-run after their count showed `0 → 0` and `1 → 1`, i.e. they had not landed
or the pattern matched the sabotaged name as a substring).

SPEC IMPACT: None. The binding archetype prototypes fix composition and colour,
neither of which moves here; motion is not specified in them.
