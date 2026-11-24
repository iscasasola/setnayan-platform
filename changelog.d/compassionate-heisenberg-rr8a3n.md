## 2026-11-24 · perf: the 3 slowest pages under 0.7 s (first pass, measured)

The owner's rule: every page loads in under 0.7 s at 390 px. Every page was measured first: headless Chromium at 390 × 844, 4× CPU, Fast 4G (Chrome's preset: 9 Mbps × 0.9 down, 165 ms RTT), cold cache, 3 runs (5–9 interleaved for before/after), median. Public pages were measured on production (signed out, read-only), signed-in screens on the `/dev/*` labs in a local production build. The full ranked table, the before/after and the next list are in the PR body.

- **Front page `/` and Discover `/?discover=1` (one page, one fix):** the sample wedding's full photos (`public/demo/maria-jose/*.webp`, 1.1–1.8 MB each) were drawn as a 124 × 156 Papic pile and a 150-px event tile, and the event shelf and the 64-px "Keep it" row drew full 70–155 KB marketing renders. A first open downloaded 9.9 MB, and the main thread was busy until ~10 s. They now read copies at their drawn size:
  - `public/demo/maria-jose/sm/` (480 px short side, 11–27 KB), through `demoSmallPhoto` in `front-door-landing.tsx`;
  - `public/marketing/2026-11-04/sm/` (560 px, 31–62 KB), through the new `marketingSmallPhoto` beside `marketingPhoto` in `lib/front-page-photos.ts`.
  - The first-screen hero is unchanged: it is drawn ~560 × 420 CSS px under `object-fit: cover`, so the 1600-px file is the right size for a 3× phone.
  - Guard: `app/_components/frontdoor/the-front-door-photos-are-drawn-small.test.ts` (each copy exists, each stays under 80 KB, no full demo photo returns). 2 sabotages, each red.
- **Suppliers (`/dashboard/[eventId]/vendors`):** the pinned block's `sync` (`services-takeover.tsx`) read the layout, wrote `--sup-top`, read again, wrote `--stick-h`, read again. That was three whole-page layouts and style passes per call at mount, the page's single largest script cost (~350 ms at 4× CPU). Now every reading comes first, then the writes. Behaviour is unchanged: "stuck" is still read before the row moves, and `transitionend` asks again.
- Tried and **not shipped**, because the interleaved measurements showed no gain: deferring the mount-time measurements of the bottom nav, the thumb row and the tuck. Their layout cost moved to the next reader. Also stripping the `html` / `body` `:has()` rules (an in-browser experiment only).
- No migration. No new server action. No new table, route or price.

SPEC IMPACT: None. Same pictures at the size they are drawn, and the same pinned-block behaviour with fewer layout passes. The house standard's G1 target is unchanged.
