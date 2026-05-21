import { NextResponse } from 'next/server';

/**
 * Shallow liveness probe — per iteration 0035 Observability § 2.
 *
 * Returns instantly with `{ ok, ts, region, version }`. No upstream calls,
 * no database hit, no R2 hit. The point is to answer "is the Vercel function
 * + Next runtime able to serve a response right now?" for Better Stack synthetic
 * pings (PH region) and Vercel internal health.
 *
 * Use `/api/health/deep` for the full upstream-connectivity check.
 *
 * Cache-Control: explicitly no-store so Vercel's CDN never serves a stale 200
 * after the underlying function has gone down.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      region: process.env.VERCEL_REGION ?? 'unknown',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      env: process.env.VERCEL_ENV ?? 'development',
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}
