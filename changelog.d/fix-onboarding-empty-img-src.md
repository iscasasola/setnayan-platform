## 2026-06-28 · fix(onboarding): stop the empty-`src` image bug on pax/budget steps

`HeroImg` rendered `<img src={src}>` unconditionally, but several onboarding steps
pass `src=''` as a deliberate "no image yet" state — pax before a guest count is
entered, budget before an amount, the faith placeholder. An empty `src` is a real
bug: React warns ("An empty string was passed to the src attribute"), and the
browser **re-requests the whole current page** for that `<img>` — a needless
network hit, repeated on every render of those screens.

Fix (`onboarding-shell.tsx`): `HeroImg` returns `null` when `src` is falsy (hook
stays above the guard — rules-of-hooks safe). The figure's own placeholder styling
already fills the space (e.g. budget's "Set your number to preview the feel it buys"
card), so the empty states look identical — just without the broken `<img>`.

Verified live: drove the full experience flow (role → quiz → reveal →
reception-setting) with the console open — previously-repeated empty-`src` errors are
gone and the console is completely clean. Applies to both the experience-quiz and
legacy flows (pax/budget are shared). typecheck clean.

SPEC IMPACT: None (render-correctness + perf fix; no schema, copy, or flow change).
