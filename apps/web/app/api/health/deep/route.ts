import { NextResponse } from 'next/server';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';
import { getR2Client, isR2Configured, R2_BUCKETS } from '@/lib/r2';

/**
 * Deep health probe — per iteration 0035 Observability § 2.
 *
 * Verifies upstream dependencies are reachable within 2 s:
 *   - Supabase Postgres connectivity (cheap SELECT via service-role client)
 *   - Cloudflare R2 connectivity (HEAD on the media bucket)
 *   - Required environment variables present
 *
 * Returns 200 with `{ ok: true, checks: {...} }` when everything is green.
 * Returns 503 with `{ ok: false, failing: [...], checks: {...} }` when any
 * check fails. Better Stack should be configured to treat non-200 as down.
 *
 * Each check is wrapped in `Promise.race` against a 1.5 s timeout so a wedged
 * upstream cannot stall the probe past the 2 s SLA in the spec.
 *
 * No PII in the response — only ok/duration_ms/error_class per check. The
 * actual error message goes to stderr (Vercel Log Drains → Better Stack) but
 * not the response body.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 5;

// 3000ms (up from 1500ms) gives buffer for Vercel iad1 → Supabase Singapore
// transcontinental round-trip on cold-start. Per CLAUDE.md 2026-05-28 pre-pilot
// audit, live curl tests showed first cold call timing out at 1505ms (right at
// the previous 1500ms boundary) then 5 subsequent warm calls succeeding in
// 276-895ms. The bump eliminates the false-positive timeout while staying well
// under the 5s maxDuration ceiling above.
const CHECK_TIMEOUT_MS = 3000;

type CheckResult = {
  ok: boolean;
  duration_ms: number;
  error_class?: string;
};

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms),
    ),
  ]);
}

async function checkSupabase(): Promise<CheckResult> {
  const t0 = performance.now();
  try {
    const client = createAdminClient();
    // Cheap, side-effect-free SELECT against a table that always exists.
    // `users` is in the V1 base schema; `head: true` issues a HEAD that returns
    // no rows. The previous `count: 'exact'` forced a full table scan to
    // populate the count value, which we don't actually need for a liveness
    // probe — only that the query succeeds. Dropping count tightens this from
    // ~600-1500ms to ~50-300ms on a warm path, eliminating the cold-start
    // false-positive timeout flagged in CLAUDE.md 2026-05-28 pre-pilot audit.
    //
    // PostgrestFilterBuilder is a thenable, not a Promise, so wrap it in
    // Promise.resolve() to satisfy withTimeout<T>'s Promise<T> signature.
    // The .select() return type is the awaited shape `{ data, error, status, statusText }`.
    const query = client
      .from('users')
      .select('user_id', { head: true })
      .limit(1);
    const { error } = await withTimeout<Awaited<typeof query>>(
      Promise.resolve(query),
      CHECK_TIMEOUT_MS,
      'supabase',
    );
    if (error) {
      return {
        ok: false,
        duration_ms: Math.round(performance.now() - t0),
        error_class: 'query_error',
      };
    }
    return { ok: true, duration_ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      ok: false,
      duration_ms: Math.round(performance.now() - t0),
      error_class: err instanceof Error ? err.message.split(':')[0] : 'unknown',
    };
  }
}

async function checkR2(): Promise<CheckResult> {
  const t0 = performance.now();
  try {
    if (!isR2Configured()) {
      return {
        ok: false,
        duration_ms: Math.round(performance.now() - t0),
        error_class: 'not_configured',
      };
    }
    const client = getR2Client();
    if (!client) {
      return {
        ok: false,
        duration_ms: Math.round(performance.now() - t0),
        error_class: 'no_client',
      };
    }
    await withTimeout(
      client.send(new HeadBucketCommand({ Bucket: R2_BUCKETS.media })),
      CHECK_TIMEOUT_MS,
      'r2',
    );
    return { ok: true, duration_ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      ok: false,
      duration_ms: Math.round(performance.now() - t0),
      error_class: err instanceof Error ? err.name : 'unknown',
    };
  }
}

function checkEnv(): CheckResult {
  const t0 = performance.now();
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'ENCRYPTION_KEY',
    'CRON_SECRET',
  ];
  const missing = required.filter((k) => !process.env[k]);
  return {
    ok: missing.length === 0,
    duration_ms: Math.round(performance.now() - t0),
    error_class: missing.length > 0 ? `missing:${missing.length}` : undefined,
  };
}

export async function GET() {
  const t0 = performance.now();
  const [supabase, r2] = await Promise.all([checkSupabase(), checkR2()]);
  const env = checkEnv();

  const checks = { supabase, r2, env };
  const failing = Object.entries(checks)
    .filter(([, v]) => !v.ok)
    .map(([k]) => k);

  const ok = failing.length === 0;
  const total_ms = Math.round(performance.now() - t0);

  // Stderr trail for Vercel Log Drains → Better Stack.
  if (!ok) {
    console.error('[health.deep] failing checks', { failing, checks, total_ms });
  }

  return NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
      region: process.env.VERCEL_REGION ?? 'unknown',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      env: process.env.VERCEL_ENV ?? 'development',
      total_ms,
      ...(ok ? { checks } : { failing, checks }),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}

export async function HEAD() {
  // HEAD returns 200 only if all checks pass — cheap probe for synthetic
  // monitors that only need a status code.
  const [supabase, r2] = await Promise.all([checkSupabase(), checkR2()]);
  const env = checkEnv();
  const ok = supabase.ok && r2.ok && env.ok;
  return new NextResponse(null, {
    status: ok ? 200 : 503,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}
