/**
 * background-writes.ts — ONLY THE PRODUCTION DEPLOYMENT RUNS THE BACKGROUND
 * WRITES (2026-10-13, guest-load fix). Pure: reads the environment it is handed.
 *
 * 🧯 WHY. Every builder's local `next dev` on the owner's Mac uses an
 * `.env.local` that points at the PRODUCTION database, and production measured
 * what that costs: ~2,271 rejected + ~1,685 accepted calls a day from those
 * dev servers — periodic-job claims (`claim_periodic_job`), fault records
 * (`record_app_fault`), telemetry counts — on a free database whose stalls are
 * what make a guest's invitation fail to load. A dev server must never claim a
 * production job window (a retention sweep or a reminder email run from a
 * half-built branch), nor write its own half-built errors into the owner's
 * Problems list.
 *
 * THE RULE: these run only on Vercel's PRODUCTION deployment —
 *   NODE_ENV === 'production'      (never `next dev`, never a test or script)
 *   AND VERCEL_ENV === 'production' (never a preview, which shares the prod
 *                                    database; never a local `next start`).
 * Everywhere else they quietly do nothing — the same "skip now" answer each of
 * them already gives when the database refuses.
 *
 * Held by `lib/background-writes.test.ts`.
 */
export function backgroundWritesAllowed(env: Partial<Record<string, string | undefined>> = process.env): boolean {
  return env.NODE_ENV === 'production' && env.VERCEL_ENV === 'production';
}
