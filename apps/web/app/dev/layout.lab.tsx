/**
 * /dev/* — the ONE production gate over every lab (Build 5 fix G2, 2026-11-10).
 *
 * Every lab page already opens with `if (process.env.NODE_ENV === 'production') notFound();`, and
 * production answers 404 for them today (measured: `curl -sL https://setnayan.com/dev/selfie-lab` → 404).
 * But that was one line copied into every page by hand: a new lab that forgot it would ship on the live site, some of them
 * with `createAdminClient()` (categories-lab, supplier-print-lab). This layout wraps EVERY route under
 * `app/dev`, so the gate can no longer be forgotten. The per-page lines stay — two locks, not one.
 *
 * WHY `NODE_ENV`, not `VERCEL_ENV === 'production'`: `next build` sets NODE_ENV=production on Vercel
 * previews too, so previews 404 the labs as well — which is the house convention (`E2E_LABS=1` runs them
 * against `next dev` only; see `tests/e2e/the-page-never-scrolls-sideways.spec.ts`). A preview's env is
 * production's Supabase, so opening labs there would hand a fixture screen the real database. Labs run on
 * `next dev` with the dummy lab env.
 *
 * ⚠ A layout does NOT wrap a `route.ts` handler or a `'use server'` module — those are their own
 * endpoints. `the-labs-never-ship.test.ts` (beside this file) refuses a route handler under /dev and
 * requires every `'use server'` module here to refuse production itself.
 */
import { notFound } from 'next/navigation';

export default function DevLabsLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
