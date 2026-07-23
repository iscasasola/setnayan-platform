import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { papicPoolGalleryActive } from '@/lib/papic-pool-gate';
import { getPoolGalleryPage } from '@/lib/papic-pool-gallery';

// GET /api/papic/guest-pool?before=<ISO cursor>
//
// Load-more read for the Shared Pool Gallery (/papic/pool). The guest is the
// setnayan_guest_session cookie; the read goes through the SECURITY DEFINER
// guest_pool_gallery RPC which enforces every gate server-side (the per-event
// couple toggle, the 'clean' allowlist, hidden_at, FaceBlock baked-blur,
// photo_consent veto, web-copies-only). Triple-gated: the env flag AND the
// 'papic_pool_gallery' DPO control here (papicPoolGalleryActive, fail-closed,
// env short-circuits first) + the per-event toggle inside the RPC. Cursor = last tile's capturedAt (keyset,
// no PII in the URL).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await papicPoolGalleryActive())) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 404 });
  }
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }

  const before = new URL(req.url).searchParams.get('before');
  const page = await getPoolGalleryPage(session.guest_id, before);
  return NextResponse.json({ ok: true, tiles: page.tiles, nextCursor: page.nextCursor });
}
