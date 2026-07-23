import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryEnabled } from '@/lib/papic-pool-flag';

// POST /api/papic/guest-pool-link — "I'm in this."
//
// The session guest links a pool capture to themselves: a photo_tags row with
// source='manual_pick', written through the SECURITY DEFINER guest_link_capture
// RPC (photo_tags has no user-facing write policy — the papic_tag_guest_capture
// route shape). The RPC re-checks everything server-side: the per-event couple
// toggle, that the capture passes the SAME pool read gates (same event, clean,
// not hidden, has a web copy, FaceBlock-baked when required), PHOTOS-ONLY in
// V1, and the live-only 20-cap pre-check that matches the 20270916200000
// trigger. Revives only the guest's own tombstone; a host removal is final.

export const runtime = 'nodejs';

const SOURCE_TABLES = new Set(['papic_photos', 'papic_guest_captures']);

export async function POST(req: Request) {
  if (!papicPoolGalleryEnabled()) {
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
  const { data, error } = await admin.rpc('guest_link_capture', {
    p_guest_id: session.guest_id,
    p_source_table: sourceTable,
    p_source_id: sourceId,
  });

  if (error) {
    // Missing RPC (pre-migration · 42883) → soft "unavailable", never a crash.
    if (error.code === '42883') {
      return NextResponse.json({ ok: false, error: 'unavailable' });
    }
    return NextResponse.json({ ok: false, error: 'link_failed' }, { status: 500 });
  }

  return NextResponse.json(data ?? { ok: false, error: 'link_failed' });
}
