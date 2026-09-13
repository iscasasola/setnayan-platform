import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import { readIngestHealth } from '@/lib/live-studio-ingest-health-server';

/**
 * GET /api/live-studio/ingest-health?event_id=<id>
 *
 * The control room's polling endpoint for lib/live-studio-ingest-health.ts —
 * see that module for the decision this feeds and
 * Live_Studio_Encoder_Scope_2026-09-03.md § 3.1/§ 7 for why it exists.
 *
 * Host-only (the same gate the controller page itself uses,
 * `isLiveStudioSetupHost`), so a poll cannot leak whether an event even has a
 * broadcast to someone who isn't running its control room.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!(await isLiveStudioSetupHost(eventId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const read = await readIngestHealth(admin, eventId);
  return NextResponse.json(read);
}
