## 2026-06-21 · feat(nav): mobile bottom-nav carousel page-slide

Tapping a different tab in the mobile floating bottom-nav now slides the page like a carousel (owner request): a tab to the RIGHT in the pill order → the current page slides out to the **left** and the new page enters from the **right**; a tab to the LEFT → the reverse. It's a **single** slide regardless of how many tabs are skipped (Home→Explore slides the same way as Home→Guests) — direction is the *sign* of the tab-index delta, not the count.

- **`app/_components/nav/nav-slide-controller.tsx`** (new) — one global capture-phase click interceptor (mirrors `nav-progress.tsx`), mounted once in the root layout. Scoped to the locked nav's existing `aria-label="Primary navigation"` marker; reads the clicked `<a href>` + the **live DOM** tab order (so it's automatically phase-aware / role-scoped / registry-override-aware — no hardcoded tab list), derives the direction via the same exact-or-longest-prefix active-match rule the BottomNav uses, and drives the navigation inside `document.startViewTransition`.
- **CSS** (`globals.css`) — directional `::view-transition-old/new(sn-page)` slide keyframes keyed off `html[data-sn-nav-dir]`. Only the shared content `<main>` is named `view-transition-name: sn-page` (`sidebar-shell.tsx`), so **only the content slides** — the fixed pill / sidebar / sticky top bar live in `root`, which is frozen.

**The lint-locked `bottom-nav.tsx` is NOT touched** (`lint:botnav` ✓) — the interceptor reads the nav's existing aria-label marker + rendered anchors. Progressive enhancement: the slide runs only on **mobile + motion-allowed + View Transitions-supported** (iOS Safari 18.2+ / Chrome 111+) for a **real top-level-tab change**; desktop, `prefers-reduced-motion`, unsupported browsers, sub-pages, the broken-out FAB, and back/forward all fall through to the native `<Link>` → instant swap, no error. No new dependency.

Verified: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm lint:botnav` ✓. Best seen on the Vercel preview on an iOS 18.2+ device (the animation is a progressive enhancement, so it's invisible to static checks).

SPEC IMPACT: Nav interaction — adds a mobile tab-change carousel transition. No SKU/schema/pricing/public-claim change.
