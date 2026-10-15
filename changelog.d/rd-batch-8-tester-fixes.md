## 2026-10-15 · fix(guest): Batch 8 tester fixes — no root change before hydration, tap-unveil frees the page, hint above the cookie banner, cover cue legible on a dark ground

- **W1** — `CoverSceneMenuWaits` no longer adds `sn-cover-wait` / `sn-cover-open` to `<html>` before hydration (every guest page hydrated with a mismatch on `<html className>`). The state is ONE `<style data-cover-menu="wait|open">` in `<head>`, which React 19 skips — the Veil's door (`lib/hub-veil.ts`). `globals.css` keys the bar rules on `html:has(> head > style[data-cover-menu…])`. New guard `lib/nothing-touches-the-root-before-hydration.test.ts`: no inline script text changes an attribute `app/layout.tsx` renders on `<html>`/`<body>`; three pre-existing scripts are named in its allowlist with reasons (sabotaged: re-adding the class fails tests 3 and 4).

SPEC IMPACT: None
