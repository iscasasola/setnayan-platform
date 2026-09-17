import { NextResponse, type NextRequest } from 'next/server';
import { runOAuthRefreshSweep } from '@/lib/oauth-refresh-sweep';

/**
 * POST /api/cron/oauth-refresh · header `x-cron-secret: $OAUTH_REFRESH_CRON_SECRET`
 *
 * ⚖ KEPT, NOT RETIRED. Its body moved to `lib/oauth-refresh-sweep.ts` so the
 * same work can also ride request traffic as the `oauth-refresh` periodic job —
 * because this repo has no scheduler by design, and this route's own
 * `TODO(0011): wire the actual cron schedule` was waiting on a mechanism the
 * project had decided not to have. Meanwhile five live Google grants sat with
 * expired access tokens, two of them since July.
 *
 * An owner-side cron, if one is ever set up, still works and still has to
 * present the secret. It is simply no longer the only way this runs.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.OAUTH_REFRESH_CRON_SECRET ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'OAUTH_REFRESH_CRON_SECRET not configured' },
      { status: 503 },
    );
  }
  if (!secret || !timingSafeEqual(secret, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runOAuthRefreshSweep();
  if ('error' in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result, { status: 200 });
}
