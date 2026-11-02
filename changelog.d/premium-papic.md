## 2026-06-25 · feat(marketing): premium-UI motion pass on /papic

Premium-UI motion + token-hygiene pass on the `/papic` marketing landing page.
Purely additive: no copy / route / IA / CTA / metadata / JSON-LD / logic change.
The page (`apps/web/app/papic/page.tsx`) stays a force-static Server Component —
verified `○ /papic` (Static, 1h/1y revalidate) in the production build. All GSAP
lives in a new `'use client'` leaf island, `apps/web/app/papic/_papic-motion.tsx`,
consuming the shared `_premium` primitives (`useLineReveal`, `useReveal`,
`usePanelIntro`, `useSettle`, `PanelThread`).

- **Signature** — the "How it works" step 02 ("Every photo finds its people")
  hosts a local presentational `SettleTiles`: six abstract token-coloured rounded
  rects (`--m-ivory` / `--m-paper-2`, NO real images, NO faces) that begin
  scattered/overlapped and **settle into a tidy 3×2 grid** via `useSettle` in one
  ~1s move — "your photos find you" made literal. `SettleTiles` owns its OWN
  `useSettle` ref (threshold 0.4), scoped SEPARATELY from the "How it works"
  panel's `usePanelIntro` root, so the two IntersectionObserver entrances don't
  double-fire.
- **How it works** — the whole section is one `usePanelIntro` panel with exactly
  ONE `PanelThread tone="light"` (champagne gutter stitch); the three step `<li>`s
  carry `data-premium-item` and stagger-rise.
- **Hero** — `useLineReveal` (mount) serif line-reveal on the `<h1>` + a quiet
  `useReveal` rise on the subhead/CTAs. No collage, no parallax (text-led so the
  sort stays the one spectacle).
- **VS list / Two ways** — quiet staggered `useReveal` rows/cards; strikethroughs
  are NOT animated; `clearProps:transform` keeps CSS hover alive. VS list kept as
  `<ul>`/`<li>` via a `RevealList` wrapper (no IA change).
- **FAQ + CTA** — incidental zero-dep `Reveal` fade-up.
- **Token hygiene** — value-equivalent hex→`--m-*` swaps (`#1E2229`→`--m-ink`,
  `#FBFBFA`→`--m-paper`, `#5C2542`→`--m-mulberry`, gold `#C5A059`→`--m-orange`
  hairline). Gold capped: exactly ONE `PanelThread`, CTA border is a single
  `--m-orange` hairline (no glow / no new gold fill). Hex with no value-equivalent
  token left untouched (`#5F5E5A`, `#9A8F86`, `#8C6932`, CTA bg `#FBF6EA`).
- a11y: opacity-only reveals (content stays in the a11y tree); reduced-motion
  rests static (tiles pre-settled, thread fully drawn); SSR text intact.

Verification: `pnpm typecheck` ✅ · `pnpm lint` ✅ (no papic warnings) ·
`pnpm build` ✅ (`/papic` still `○` Static).

SPEC IMPACT: None
