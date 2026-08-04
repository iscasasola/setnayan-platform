import { createClient } from '@supabase/supabase-js';
import { createLoggingFetch } from './db-error-log';

/**
 * Server-only Supabase client that uses the `service_role` key and bypasses RLS.
 *
 * Used for operations that need to read or write data the current user can't see
 * through RLS — e.g., validating an event-join token before the scanner has
 * become an event_member. Treat every call as "trust the function" and perform
 * application-level authorization inside the calling code.
 *
 * Never import this from a client component.
 *
 * LOCAL-DEV FALLBACK (2026-07-15): `SUPABASE_SERVICE_ROLE_KEY` is marked
 * Sensitive on Vercel, so `vercel env pull` returns it EMPTY — no local
 * checkout has it, and any page with an unconditional createAdminClient()
 * call (e.g. the couple Merkado) hard-crashed to the error boundary on every
 * dev server. In `next dev` only, a missing service key now falls back to the
 * anon key: construction succeeds, RLS applies, admin-only reads come back
 * empty and privileged writes fail as ordinary Supabase errors — which the
 * call sites' existing error paths absorb, so pages render with degraded data
 * instead of dying at client construction. `next build` / `next start` /
 * CI / Vercel (NODE_ENV=production) keep the hard throw unchanged.
 */

// One warning per dev-server process, not one per call — createAdminClient is
// invoked hundreds of times per page tree.
let warnedDevFallback = false;

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && !key && process.env.NODE_ENV === 'development') {
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (key && !warnedDevFallback) {
      warnedDevFallback = true;
      console.warn(
        '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is unset — dev-only fallback to the ANON key. ' +
          'RLS applies: admin-only reads return empty, privileged writes fail. ' +
          'Set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local for real admin behavior.',
      );
    }
  }
  if (!url || !key) {
    throw new Error('Missing SUPABASE env vars for admin client.');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Surface failed PostgREST calls instead of letting them resolve to
    // `data: null` and render as an empty list. See ./db-error-log.
    global: { fetch: createLoggingFetch('admin') },
  });
}

/**
 * The service-role client for MONEY WRITES — `public.orders` / `public.payments`.
 *
 * Identical to `createAdminClient()` except it REFUSES the dev anon-key fallback
 * above.
 *
 * Since SEC-4b, INSERT (migration 20271008178212) and DELETE (20271024090000)
 * on both tables are revoked from `authenticated` and `anon`. So an anon-key
 * client does not degrade gracefully here the way it does for a read: every
 * mint becomes a bare `42501` that each action absorbs into its generic "please
 * try again", which is a genuinely baffling afternoon for whoever is running
 * `next dev` without the sensitive key. Fail loudly and name the variable.
 *
 * ⚠ SCOPE: this changes `next dev` ONLY. In production `createAdminClient()`
 * already throws when the key is missing — the fallback is gated on
 * `NODE_ENV === 'development'` — so no deployed environment behaves differently
 * because of this function. It buys a clear local error, not a new prod gate.
 *
 * Read paths keep `createAdminClient()`: degraded-but-rendering is the right
 * trade for a dashboard, and the wrong one for a payment.
 */
export function createMoneyWriterClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required to write orders/payments. Since SEC-4b those ' +
        'tables reject the anon key (INSERT + DELETE revoked from authenticated/anon), so the ' +
        'dev fallback in createAdminClient() cannot be used for money writes. Set it in ' +
        'apps/web/.env.local — it is marked Sensitive on Vercel, so `vercel env pull` returns ' +
        'it empty and you must copy it from the Supabase dashboard.',
    );
  }
  return createAdminClient();
}
