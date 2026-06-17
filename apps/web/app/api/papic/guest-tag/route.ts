import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { parsePapicTagScan } from '@/lib/papic-tag';

// POST /api/papic/guest-tag
//
// Scan-to-tag for the GUEST disposable camera — the QR fallback (owner-confirmed)
// so a guest's own captures become findable in "Photos of you" even when face
// auto-tag is off. The guest is identified by the setnayan_guest_session cookie;
// they scan another guest's place-card QR (one guest) or a table sign QR (fan-out
// to seated guests). The write goes through the SECURITY DEFINER
// papic_tag_guest_capture RPC (photo_tags has no user-facing write policy); the
// RPC re-checks that the capture is THIS guest's own and resolves the target only
// within the capture's event. Untagged-still-delivered: a tag miss never affects
// the saved photo. Mirrors the seat surface's tagSeatCapture, cookie-keyed.

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }

  let body: { captureId?: unknown; scanned?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const captureId = typeof body.captureId === 'string' ? body.captureId.trim() : '';
  const scanned = typeof body.scanned === 'string' ? body.scanned : '';
  if (!captureId) {
    return NextResponse.json({ ok: false, error: 'missing_input' }, { status: 400 });
  }

  const parsed = parsePapicTagScan(scanned);
  if (!parsed) return NextResponse.json({ ok: false, error: 'unrecognized' });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('papic_tag_guest_capture', {
    p_guest_id: session.guest_id,
    p_capture_id: captureId,
    p_guest_token: parsed.kind === 'guest' ? parsed.token : null,
    p_table_ref: parsed.kind === 'table' ? parsed.ref : null,
  });

  if (error) {
    // Missing RPC (pre-migration · 42883) → soft "unavailable" the camera can
    // show without crashing.
    if (error.code === '42883') {
      return NextResponse.json({ ok: false, error: 'unavailable' });
    }
    return NextResponse.json({ ok: false, error: 'tag_failed' }, { status: 500 });
  }

  return NextResponse.json(data ?? { ok: false, error: 'tag_failed' });
}
