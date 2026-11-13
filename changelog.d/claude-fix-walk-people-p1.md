## 2026-11-13 · fix(people): walkthrough P1 — "Plan an event" from a Group opens the create-event sheet

- **F-W3-13** Group › All events › "Plan an event" (a client navigation to `/dashboard/create-event?samahan=…`) showed
  "This page doesn't exist" with HTTP 200. Cause: `(launcher)/@modal/(.)create-event` intercepts that navigation from
  ANY page under /dashboard and draws its sheet inside the launcher layout, whose main slot had no `default` — so from
  any page outside Home (Group, Life flash, Library) the slot rendered not-found. A refresh is never intercepted, hence
  the real page then. Fix: `app/dashboard/(launcher)/default.tsx` (renders nothing; the sheet is the content, closing
  it returns to the page the tap came from). Reproduced and confirmed on a minimal Next 15 app of the same route shape.

SPEC IMPACT: None.
