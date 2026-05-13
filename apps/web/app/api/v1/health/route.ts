import { NextResponse } from 'next/server';

/**
 * Public liveness probe. Returns 200 with a static payload — useful for
 * uptime monitors and as a sanity check that the /api/v1 route tree is
 * reachable. No authentication required.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      api_version: '1',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
