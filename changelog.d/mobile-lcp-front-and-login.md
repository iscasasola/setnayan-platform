## 2026-11-13 · perf(front-door, login): stop shipping other routes' JavaScript to `/` and `/login`

The 13 Nov CI Lighthouse audit (mobile, `.lighthouserc.json`) measured `/` LCP 8.2 s and `/login` 5.9 s. Re-measured on a production build with that config and broken down with Lighthouse's own simulator (Lantern): on this profile LCP is set by **every byte and request started before the observed LCP** (1.6 Mbps shared, 6 HTTP/1.1 connections at 150 ms RTT). TTFB was 30–70 ms, so server reads are not the cause here; fonts are already `swap` with three measured preloads.

Four leaks, each the same shape: script a page never runs, written into its HTML.

- **The root 404 shipped the front door's JavaScript to other pages.** `app/not-found.tsx` is in every route's RSC payload, and its two server-rendered `<Link>`s carried a `next/link` chunk list that Next 15.5 merges across the root group with `Object.assign` (last recorder wins — `app/page`). `/login` therefore downloaded `app/page-*.js` and 17 front-door chunks. The links are now a client island, `app/not-found-links.tsx` (same markup). `/login`: 29 → 12 scripts.
- **`/` shipped the `(shell)` layout's chunks** (~37KB gz) because `FrontDoorShell` is also rendered by `app/(shell)/layout` and route groups collapse into the root group. `/` now has its own reference, `front-door-shell-for-home.tsx`.
- **Client code imported `lib/account-jars.ts`**, whose server helpers name `Buffer`, so webpack injected the `buffer` polyfill (~17KB gz) wherever the account switcher ships. `signOutAllAction` moved to `lib/account-sign-out-path.ts` (re-exported, so every import holds).
- **Conditional client pieces were in every `/`'s first load**: the signed-in search's "Add your own" walk (~34KB gz), Discover's signed-in thumb row (~10KB), and the supplier view's sticky header/filter drawer (~27KB) and 268-icon folder strip (~24KB). They are now `next/dynamic` with SSR on (`front-door-lazy.tsx`, `explore/_components/marketplace-lazy.tsx`): same server HTML when drawn, not fetched when not.

Result (production build, repo Lighthouse config, warm server, median of 3; full table in the PR): `/` 8.14 s → 5.7–7.2 s, `/login` 5.77 s → 4.65 s. `/` first-load JS 293 → 200 kB. Pixel-identical at 412×823 on `/`, `/login` and the root 404. **The 2.5 s goal is not met**: what remains is the root layout's 624KB-raw stylesheet, the three preloaded font families (~160KB), the 198KB hero photo and ~110KB of framework JS — each needs an owner-level decision (named in the PR).

Guards: `app/the-root-404-pulls-in-no-page.test.ts`, `app/_components/frontdoor/the-front-page-ships-only-what-it-draws.test.ts`, `app/_components/frontdoor/the-hero-photo-loads-first.test.ts` (the LCP image stays server-rendered, `fetchPriority="high"`, never lazy) — each sabotage-checked.

SPEC IMPACT: None.
