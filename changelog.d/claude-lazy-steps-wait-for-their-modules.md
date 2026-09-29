## 2026-09-29 · test(maker): lazy Details pieces are awaited, not timed — five tests stop racing the CI runner

Since the Details pieces went lazy (`details-lazy.tsx`, commit 3593b5be2), five
render tests waited for them with the same loop: re-render every 10ms while the
HTML held `data-lazy-slot=`, give up after 50 tries (500ms). On a loaded runner
the guess lost — PR #6159, run 36585597410, `details-guided-flow.test.ts` "(6) a
step is its item…" failed "no step heading" with the slot still in the HTML,
while passing 4/4 locally. The loop also never waited for a `SlotNone` piece
(it draws nothing while loading) — `GuideHead` is one.

- New `lib/render-settled.test-helper.ts` `renderSettled(el, lazyModules?)`:
  awaits every `next/dynamic` piece's own `preload()` (react-loadable under Node
  — the same promise its render waits on) with `Promise.allSettled`, renders
  once, and THROWS if a visible loading slot is still drawn. No timer.
  `Loadable.preloadAll()` was tried first and rejected: it starts every loader,
  and `maker-logo.tsx` (reaches `server-only`) cannot load under Node.
- `details-guided-flow`, `paid-mark`, `fast-print-previews`,
  `free-themes-are-free` and `theme-print-previews-wear-the-theme` use it; their
  four copies of the loop are gone.
- Probes: with `GuideHead`'s load delayed 1.5s the new helper passes 15/15 and
  the old loop fails exactly as CI did ("no step heading"); with its load made to
  throw, "(6)" fails — a broken piece is never a pass. 44/44 across the five
  files, three runs in a row.

SPEC IMPACT: None
