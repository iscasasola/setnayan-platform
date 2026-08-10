import { NextResponse } from 'next/server';

/**
 * Receives the stack of whatever is rewriting browser history in a loop.
 *
 * Temporary diagnostic for the signed-in `/dashboard` outage: Safari throws
 * `SecurityError: Attempt to use history.replaceState() more than 100 times per
 * 10 seconds`, two rollbacks did not fix it, and static analysis cleared every
 * candidate. The throwing call belongs to Next's own `HistoryUpdater`, so the
 * cause is several frames up the stack — information a stack trace has and
 * reading the source does not.
 *
 * It logs and returns 204. It stores nothing, reads no database, and requires
 * no session, because a page that is already failing must be able to report the
 * failure. The payload is capped and carries a PATH only, never a query string.
 */
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      count?: unknown; windowMs?: unknown; path?: unknown; stack?: unknown;
    };
    const clamp = (v: unknown, max: number) =>
      typeof v === 'string' ? v.slice(0, max) : '';
    // console.error, deliberately: it is what surfaces in the runtime log this
    // can be read back from. The marker is distinctive so it can be found among
    // everything else the platform logs.
    console.error(
      '[HISTORY-STORM]',
      JSON.stringify({
        count: typeof body.count === 'number' ? body.count : -1,
        windowMs: typeof body.windowMs === 'number' ? body.windowMs : -1,
        path: clamp(body.path, 200),
        stack: clamp(body.stack, 4000),
      }),
    );
  } catch {
    console.error('[HISTORY-STORM] unparseable report');
  }
  return new NextResponse(null, { status: 204 });
}
