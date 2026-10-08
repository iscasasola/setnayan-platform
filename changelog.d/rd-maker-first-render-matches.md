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

⚠ **Found, not fixed** (measured the same way, old code, dev server): the server's Stages
panel element is NOT the one on the page after the Maker settles on ANY of the three loads
— with or without an error it is replaced by one built in the browser. Reading of it (not
proven): the shell's own mount effects change its state (the device → phone, the lower
third's slot, the remembered view) before the panel's lazy boundary has hydrated, and React
then builds a boundary that received an update in the browser instead of hydrating it. This
fix removes the error; it does not make the server's panel survive. That needs its own
change (and a measure on a production build — a dev server loads the panel's file late).

SPEC IMPACT: None.
