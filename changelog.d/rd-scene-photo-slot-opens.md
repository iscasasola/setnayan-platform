## 2026-10-19 · fix(maker): a canvas that never answers taps is loaded again, then said — never a dead page drawn as a working one

Owner, 2026-10-18 night, live in his Safari (~800 px wide): *"cannot select again"* — no part of the Maker's canvas
(countdown, note, E-Gifts, a scene's ＋ Photo) could be picked; the toolbar stayed on "INVITATION › HOME" with an
empty Edit. The same event worked in Chromium. Not reproduced in the Maker lab (Playwright WebKit 26.4 and Chromium,
375–1024 px, mouse and touch): every tap there selects and a ＋ Photo opens its Upload sheet.

What the Maker did with a canvas whose bridge never says `ready`: `BufferedCanvasFrame` showed it after
`NO_BRIDGE_MS` (right for a slow page) and nothing else noticed — the page drew, every tap vanished, no fault was
recorded. Now (`canvas-bridge-watch.ts`):

- the frame on screen, loaded and still without `ready` after 6 s, is loaded again once by itself (it never took a
  tap, so there is nothing on it to lose; the Maker shell, drafts and saves are untouched);
- still silent → the toolbar says "The page isn't answering taps." with one Reload (row 1, over any tool);
- each time a fault goes to app_fault_issues (`trackFailure`, kind DEAD_TAP, loaded only when there is one): browser,
  the missing handshake, whether the frame was a kept/loading one, reloads, and whether its own document is the HOST
  canvas (the Maker's section marks) or a guest's page — so the next report carries its own evidence.
- Lab: `lab_nobridge=1` draws the canvas without its bridge.

Guard: `canvas-bridge-watch.test.ts` drives the real watch and reads the wiring.

SPEC IMPACT: None.
