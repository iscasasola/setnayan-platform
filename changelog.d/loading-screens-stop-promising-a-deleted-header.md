## 2026-08-25 · fix(ui): loading screens stop promising a page header that was deleted

The page-header retirement of 2026-08-21 (PRs #4664 + #4669) removed the eyebrow,
the title and the (i) from every page in the three authenticated trees. The
loading skeletons were never told.

Measured on `origin/main` a8f8601: **129** `loading.tsx` files under
`app/dashboard`, `app/vendor-dashboard` and `app/admin` reached `HeaderSkeleton`
through a shared page template, and **2** more hand-rolled the same block
(`app/admin/loading.tsx`, `app/dashboard/(account)/loading.tsx`). All 131 drew an
eyebrow bar plus a 32–40px title bar; the arriving page paints neither, so the
content jumped up by the height of a header that no longer exists. (The brief
said 98 — that count predated the templates' growth.)

- `HeaderSkeleton` takes `title`, **defaulting to false**, and renders nothing at
  all when there is neither a title nor an action button.
- All eight page templates forward it.
- **13** routes that DO paint a real visible eyebrow + title — the doors
  (`<DoorShell>`), the Papic and Live Studio seat claims, the join steps, the
  guest welcome and find-my-table — opt back in explicitly.
- `app/dashboard/[eventId]` and `app/vendor-dashboard` keep their title bars:
  both paint a genuine visible `.sn-h1` hero. They are admitted by the guard's
  derived rule, not by being named in it.
- New guard `components/skeletons/loading-screens-match-the-page.test.ts` walks
  every `loading.tsx` and answers "may this route draw a title?" from the route's
  own `page.tsx` + `_components`, with floors on both directions so an empty
  sweep cannot pass. 3 assertions, each mutation-checked by occurrence count
  (`<header` 0→1 red · `title = false` 6→5 red · a door's opt-in 3→0 red).
  Its first cut was DECORATIVE: it read every `.tsx` beside the loader, and
  `app/admin/error.tsx` carries an `<h1>`, so the admin root exempted itself and a
  restored header block passed green.

SPEC IMPACT: None — this is the loading-state half of a shipped, owner-locked
retirement; no product decision changes.
