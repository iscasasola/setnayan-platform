## 2026-10-08 · fix(maker): the Stages panel's first render in the browser is the server's — the guest bar's host is found after it, never during it

Controller, 2026-10-08, measured on the review copy (375 × 812, the dev lab, idle): open
the new Maker, tap Studio › Look, load the Maker again → React throws *"Hydration failed
because the server rendered HTML didn't match the client"*; the lines only the browser had
were the guest's tab bar (`<nav data-stage-guest-bar>`), right after the part's edges. The
code is on `origin/main` too — not from the Look work.

- **Cause** (`launch/_components/stage-tools.tsx`): the Maker's shell — the box the guest
  bar is drawn into — was looked up in the page WHILE RENDERING
  (`typeof document === 'undefined' ? null : document.querySelector('[data-maker-shell]')`).
  The server has no page, so its HTML has no bar; the browser has one, so its first render
  drew the bar. React hydrates a portal's children against the tree around it, finds no
  `<nav>` there, refuses the server's panel and builds it again in the browser.
- **Why only with a remembered view** (a reading that fits every measurement below, not
  proven line by line): the panel arrives in its own lazy boundary. With nothing remembered
  that boundary is built in the browser rather than hydrated (see "found, not fixed"), so
  nothing is compared and nothing is reported. With a view remembered React does try to
  hydrate it — and the comparison fails on the bar.
- **Fix:** the shell is found once the panel is on the page (a layout effect, so the bar
  is there before the browser paints — it never arrives a frame late). The first render in
  the browser now draws exactly what the server drew.
- **The real Maker has it too** (read, not seen in a browser): `launch/page.tsx` mounts the
  same shell and the same panel whenever the new Maker is on (`stagesStudio`). The shipped
  Maker (the flag off) never mounts this panel.
- Requests: none added, none removed.

Guard: `lib/the-maker-first-render-is-the-servers.test.ts` (2, new) — the REAL panel is
rendered twice with the same props: as the server renders it, and as the browser's first
render computes it (a page that holds the Maker's shell; no effect run). Outside its
portals the HTML must be the server's, and no portal may draw an element. On the old line
it fails with the controller's own diff (the `<nav data-stage-guest-bar>`). 2 sabotages
seen red (the old line; state whose first value is read off the page).
What it is not: a browser hydrating a page — there is no DOM in this suite. That is the
measurement below.

Measured in a headless browser on the review server BEFORE the fix (old code):
fresh tab → 0 hydration errors · Studio › Look, then load again → 1 hydration error (the
diff above) · memory cleared, load again → 0.

Measured AFTER (controller, headless Chromium on the review copy, 375 × 812): the second
load with the remembered view present → 0 hydration errors (it was 1 before, every time).

⚠ **Found, not fixed — for the speed lane, to be measured on a production build** (the
controller's ruling, 2026-10-08: do not start it here; a dev server exaggerates it; the
rehearsal workflow that builds and runs `next start` on a GitHub runner is where to measure).

- **What was measured** (headless Chromium on the review server, dev build, 375 × 812, old
  code; script `hyd2.mjs` in the builder's scratch folder): the server's `[data-stage-tools]`
  element was tagged as the browser parsed it, and looked for again three seconds after the
  Maker settled. On ALL THREE loads — fresh tab, remembered view, memory cleared — it was no
  longer in the page: a browser-built panel stood in its place. Two of those loads logged no
  error at all. So the server's Stages panel is thrown away whether or not React reports it.
- **Reading** (fits every measurement; not proven line by line): the panel arrives in its own
  lazy boundary (`next/dynamic` → `<Suspense>`), which React leaves to hydrate last. Before it
  does, the shell's own mount effects change the shell's state — `setDevice('phone')`, the
  lower third's slot, the remembered stage / view. A boundary that receives an update before
  it has hydrated is first tried at a higher priority; if its file has not arrived yet, React
  gives up on the server's HTML and builds the boundary in the browser — silently. With a
  remembered view the higher-priority try does run, which is the only reason the mismatch
  fixed above was ever reported.
- **The idea, and its risk:** apply the shell's mount-time state inside a transition
  (`startTransition`) — React then holds that update until the boundary has hydrated, and the
  server's panel survives. RISK: `device` starts as `'desktop'` and may drive the canvas
  frame; holding the switch to `'phone'` until the panel's file arrives could load the
  canvas once as desktop and again as phone — a second guest-page render, the opposite of
  the goal. It needs: what `device` feeds on first paint, the canvas requests counted before
  and after, and a production build (a dev server compiles the panel's file on demand, so
  the file is late there far more often than it will be for a couple).
- **What this commit did and did not do:** it removed the reported failure (the first
  render now matches). It did NOT make the server's panel survive.

SPEC IMPACT: None.
