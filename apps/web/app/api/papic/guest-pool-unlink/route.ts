import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryActive } from '@/lib/papic-pool-gate';

// POST /api/papic/guest-pool-unlink — remove my own "I'm in this."
//
// Soft-tombstones the session guest's OWN manual_pick tag via the SECURITY
// DEFINER guest_unlink_capture RPC (removed_by='guest', the 20270131081062
// tombstone pattern). Never touches QR/face/table tags or other guests' rows;
// idempotent — unlinking twice is still ok.

export const runtime = 'nodejs';

const SOURCE_TABLES = new Set(['papic_photos', 'papic_guest_captures']);

export async function POST(req: Request) {
  if (!(await papicPoolGalleryActive())) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 404 });
  }
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }

  let body: { sourceTable?: unknown; sourceId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const sourceTable = typeof body.sourceTable === 'string' ? body.sourceTable : '';
  const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : '';
  if (!SOURCE_TABLES.has(sourceTable) || !sourceId) {
    return NextResponse.json({ ok: false, error: 'missing_input' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('guest_unlink_capture', {
    p_guest_id: session.guest_id,
    p_source_table: sourceTable,
    p_source_id: sourceId,
  });

  if (error) {
    if (error.code === '42883') {
      return NextResponse.json({ ok: false, error: 'unavailable' });
    }
    return NextResponse.json({ ok: false, error: 'unlink_failed' }, { status: 500 });
  }

  return NextResponse.json(data ?? { ok: false, error: 'unlink_failed' });
}
