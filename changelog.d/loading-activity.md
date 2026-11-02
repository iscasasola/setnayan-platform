## 2026-06-22 · feat(loading): randomized interactive loading activity (tap burst · wisdom · quick pick)

Every route `loading.tsx` renders `Screen` from `@/components/skeletons`, so a single addition to `Screen()` fans an engagement overlay out across all loading states automatically — no per-route wiring.

- **New client island `apps/web/components/loading-activity.tsx`** (~407 lines). Mounts as a fixed full-bleed overlay over the skeleton, randomly picks one of three activities, and disappears once content arrives:
  - **Tap Burst** — tap anywhere to spawn gold/mulberry particle bursts; a counter builds with milestone messages.
  - **Wedding Wisdom** — a contextual wedding tip that auto-advances every 5 s, with dots + a "next tip" skip; tips are per-route (guests / vendors / budget / …).
  - **Quick Pick** — an A/B preference question; the chosen option fills gold, then advances to the next after 0.85 s; contextual per route.
- **One-line insertion into `Screen()`** (`apps/web/components/skeletons/index.tsx`): `import { LoadingActivity }` + a single `<LoadingActivity />` inside the `aria-busy` section, ahead of `children`.
- **Hydration-safe:** `Math.random()` + `detectPage()` both run inside `useEffect`, so the server render returns `null` (no mismatch). The overlay is `position: fixed; inset: 0; z-index: 50` with a ~94% cream backdrop, leaving the skeleton faintly visible underneath.

Rebase fix (this is why the PR was blocked): under `noUncheckedIndexedAccess`, `const current = picks[idx]` in `QuickPick` is typed `… | undefined`, so the `current.prompt` / `current.a` / `current.b` derefs failed `tsc` with **TS18048** at lines 338/343. Added `if (!current) return null;` immediately after the index read — typecheck and lint now pass clean (exit 0).

SPEC IMPACT: None. Pure additive client-side loading UX; no schema, SKU, route, or pricing change.
