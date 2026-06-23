## 2026-06-23 · fix(monogram): Vector Studio fills its container — no beige inset frame

Owner 2026-06-23 ("remove the beige padding and make our elements fill the screen").
The Vector Monogram Studio sat inside a beige inset frame (`.frame` #ECE7DD +
16/20px padding) capped at 430px (mobile) / 1040px (desktop), itself inside a cream
padded card (`.vsroot` bg-cream + rounded border + p-5/p-7).

- `lib/monogram-studio/markup.ts`: `.frame` is now transparent, zero-padding, and
  uncapped (max-width:none) at both breakpoints — the white `.card` (canvas + panel)
  fills the available width. Desktop two-column grid widened the panel column
  (360→380) and the canvas row is taller (clamp 58vh→72vh, max 680→900) so the live
  preview genuinely "takes up the space".
- `app/dashboard/[eventId]/monogram/studio.tsx`: dropped the outer cream box
  (`rounded-2xl border bg-cream p-5 sm:p-7`) from the `.vsroot` section so the studio
  isn't double-inset; kept `scroll-mt-24 space-y-4`.

SPEC IMPACT: None (0037 monogram studio chrome only).
