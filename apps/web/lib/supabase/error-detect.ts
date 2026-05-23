/**
 * Shared Supabase/PostgREST error-detection helpers — extracted from
 * apps/web/lib/guests.ts in the third hotfix pass (PR opened 2026-05-23)
 * so every render-path helper that touches a recently-shipped migration
 * can graceful-degrade with the same detector instead of duplicating the
 * `isMissingRelationError` body per file.
 *
 * Background: the /dashboard/[eventId]/guests page hit the Setnayan
 * branded error boundary THREE times in 48 hours.
 *
 *   - PR #380 (commit 7240f05) caught raw Postgres `42P01` in
 *     `fetchGuestGroupsByEvent`. Crash moved to the next-narrowest path
 *     and re-fired with a different `digest` reference code.
 *   - PR #390 (commit ea1b79f) extended the catch to PostgREST codes
 *     `PGRST200` + `PGRST205` + message-substring fallbacks. Crash moved
 *     AGAIN and re-fired with ref 3284377371.
 *   - This third pass widens the net to EVERY query on the render path
 *     (not just `fetchGuestGroupsByEvent`) plus the layout's
 *     `fetchUserEvents` which throws unconditionally on error and is
 *     load-bearing for the entire /dashboard/[eventId]/* subtree.
 *
 * The previous narrower hotfixes silently swallowed without logging —
 * we kept guessing which query was the next-narrowest. This helper pair
 * always logs (console.error + Sentry.captureException with structured
 * context) BEFORE deciding to graceful-degrade vs re-throw, so the next
 * crash surfaces the exact call site instead of forcing another
 * speculative patch.
 */

import * as Sentry from '@sentry/nextjs';

export type SupabaseErrorShape = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/**
 * Robust missing-relation / missing-column / missing-function detector.
 * Returns TRUE when the error is "this thing isn't in the schema (cache)
 * yet" — the canonical signal that an unpushed migration is the cause
 * and the page should graceful-degrade rather than crash.
 *
 * Codes covered:
 *
 *   - `42P01` — Postgres `undefined_table`. Direct miss on a SELECT
 *     against a table that hasn't been created yet (the simple path the
 *     first hotfix #380 already caught).
 *   - `42703` — Postgres `undefined_column`. Fires when a SELECT names a
 *     column that hasn't been added yet — parallel risk for migrations
 *     that ALTER existing tables (e.g. ADD COLUMN runs in CI but not on
 *     prod yet).
 *   - `42704` — Postgres `undefined_object`. Generic "doesn't exist" for
 *     enums / types / indexes / sequences referenced by a SELECT.
 *   - `42883` — Postgres `undefined_function`. Fires when an RPC or a
 *     SQL function used in a query isn't deployed yet.
 *   - `PGRST200` — PostgREST schema-cache miss on an embedded
 *     relationship (`!inner(...)` join). Fires when either side of the
 *     FK isn't in the cache yet.
 *   - `PGRST205` — PostgREST schema-cache miss on the table itself.
 *     Fires when the table exists in Postgres but PostgREST's in-memory
 *     schema cache hasn't reloaded yet (common immediately after a push
 *     before the cache reload kicks in).
 *   - `PGRST116` — PostgREST "0 rows for single() expected 1". Not a
 *     missing-relation per se but defensively included because callers
 *     using `.single()` that hit empty result sets shouldn't crash the
 *     page when the underlying query was for an optional row.
 *
 * Fallback to message-substring match for "does not exist" / "schema
 * cache" / "could not find the table" / "could not find the function" /
 * "could not find the column" — defensive net for future PostgREST
 * versions that might rename codes.
 */
export function isMissingRelationError(
  error: SupabaseErrorShape | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (
    code === '42P01' ||
    code === '42703' ||
    code === '42704' ||
    code === '42883'
  ) {
    return true;
  }
  if (code === 'PGRST200' || code === 'PGRST205' || code === 'PGRST116') {
    return true;
  }
  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('does not exist')) return true;
  if (msg.includes('schema cache')) return true;
  if (msg.includes('could not find the table')) return true;
  if (msg.includes('could not find the function')) return true;
  if (msg.includes('could not find the column')) return true;
  if (msg.includes('relation') && msg.includes('does not exist')) return true;
  return false;
}

/**
 * Log a Supabase query error to BOTH console (visible in Vercel logs)
 * AND Sentry (with structured `extra` context so the next crash carries
 * the call site and params, not just the raw Error). Use this in every
 * graceful-degrade catch so the silent fallback still leaves a trail.
 *
 * The first two hotfixes silently swallowed without logging — we kept
 * having to guess which next-narrowest query path was crashing because
 * the error boundary's `digest` is random per error and doesn't point
 * back at the originating call site. This helper closes that gap.
 *
 * `severity`:
 *   - `'graceful_degrade'` — the call site recovered with an empty/null
 *     value and the page kept rendering. Logged as warning.
 *   - `'will_throw'` — the call site is about to re-throw because the
 *     error didn't match a known graceful-degrade pattern. Logged as
 *     error so the breadcrumb survives even if Sentry's request-error
 *     hook misses it.
 */
export function logQueryError(
  callSite: string,
  error: SupabaseErrorShape | unknown,
  extra: Record<string, unknown> = {},
  severity: 'graceful_degrade' | 'will_throw' = 'graceful_degrade',
): void {
  const ctx = {
    call_site: callSite,
    severity,
    error_code: (error as SupabaseErrorShape)?.code ?? null,
    error_message: (error as SupabaseErrorShape)?.message ?? null,
    error_details: (error as SupabaseErrorShape)?.details ?? null,
    error_hint: (error as SupabaseErrorShape)?.hint ?? null,
    ...extra,
  };

  // Visible in Vercel Functions logs even if Sentry quota is exhausted
  // or the breadcrumb-from-request-hook path fails to fire.
  console.error(`[supabase-error] ${callSite}`, ctx);

  // Send to Sentry with structured `extra` so we can pivot by call_site
  // in the dashboard. Wrap in try/catch because Sentry init can be
  // missing in some preview environments and we never want logging to
  // be the thing that takes the page down.
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(
            `Supabase query error at ${callSite}: ${
              (error as SupabaseErrorShape)?.message ?? 'unknown'
            }`,
          );
    Sentry.captureException(err, {
      level: severity === 'will_throw' ? 'error' : 'warning',
      tags: { call_site: callSite, severity },
      extra: ctx,
    });
  } catch {
    // Sentry not initialized — console.error above is the fallback.
  }
}
