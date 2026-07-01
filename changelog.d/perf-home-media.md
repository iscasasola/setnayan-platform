## 2026-07-02 · perf(homepage): defer overlay bundle + drop hero-video preload to metadata

Two first-paint wins on the homepage (`app/_components/home/HomeReskin.tsx`) from
the 2026-07-02 load-delay sweep:

- **Code-split the overlays** (finding #7) — `HomeOverlays` (Sign-in / Prices /
  vendor / login) is closed on first paint (`overlay` is null → it renders
  nothing) but was statically imported into the homepage's first-load JS. Now
  loaded via `next/dynamic({ ssr: false })` so the chunk streams lazily after
  hydration instead of blocking the initial bundle. Overlay behavior is
  unchanged (nothing to SSR while every overlay is closed).
- **Hero backdrop `preload="auto"` → `"metadata"`** (finding #24) — the admin
  hero video no longer buffers its full stream against LCP. The gradient scene
  is the real LCP element and the video src is injected post-hydration, so
  metadata-only preload is sufficient and stops the full-clip fetch from
  competing with first paint.

Deliberately NOT changed: the 5 pillar-dock tile videos. The only effective
tweak (autoplay the active tile only) would alter the "living dock" visual, and
those slots are usually unpublished in the pilot — not worth a UX regression for
a marginal gain on null media. Flagged as a design-gated follow-up.

SPEC IMPACT: None (perf only — no visual, copy, or behavior change).
