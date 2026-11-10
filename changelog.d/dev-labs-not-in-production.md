## 2026-11-10 · fix(dev): one production gate over every /dev lab (Build 5 G2)

Step 0b's route census flagged the `/dev/*` labs as "shipping in the production app". Measured first:
production already 404s them (`curl -sL https://www.setnayan.com/dev/selfie-lab` → 404, likewise
`maker-lab/guest/scrub`, `swipe-rows-lab/clients`, `home-lab`, and the three lab route handlers) —
because every lab page opens with its own `if (process.env.NODE_ENV === 'production') notFound();`.
The gate was not leaky; it was hand-copied into every page, so the next lab to forget it would ship,
and some labs call `createAdminClient()`.

- `apps/web/app/dev/layout.tsx` (new): the ONE gate — `notFound()` in production — wrapping every
  route under `/dev`. Same predicate as the per-page lines (NODE_ENV, not VERCEL_ENV): previews also
  build with NODE_ENV=production and carry production's Supabase env, so labs stay `next dev`-only,
  as `the-page-never-scrolls-sideways.spec.ts` (`E2E_LABS=1`) already assumes. Lab pages untouched.
- `apps/web/app/dev/the-labs-never-ship.test.ts` (new guard): the layout's gate is its first
  statement; no page serves `/dev/*` from outside `app/dev` (route-group escape); every `/dev`
  `route.ts` method refuses production first (layouts never wrap handlers); every `'use server'`
  module under `app/dev` refuses production; no production source links (`href` / `push` /
  `redirect`) into `/dev`. Sabotaged once per check — each fails, then passes restored.
- Playwright CI runs against `localhost` only and its lab block is skipped unless `E2E_LABS=1` on a
  dev server — no e2e hits `/dev` on production. No production menu or link points into `/dev`.

SPEC IMPACT: None
