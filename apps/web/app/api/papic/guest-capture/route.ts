import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { fetchGuestQuota } from '@/lib/papic-guest';
import { enqueueDriveCopy } from '@/lib/drive-copy';

// POST /api/papic/guest-capture
//
// The guest-camera capture endpoint for PAPIC_GUEST. The guest is identified by
// their setnayan_guest_session cookie (guest_id + event_id) — no sign-in, so
// /api/upload (which 401s anonymous callers) can't be used. This route does the
// whole capture server-side: validate the cookie, PUT the JPEG to R2 with the
// service-role R2 client, then record it through the SECURITY DEFINER
// papic_record_guest_capture RPC, which atomically re-checks + enforces the
// per-guest 150-credit pool (the client display is advisory only). Returns
// { status: 'ok' | 'quota_exhausted' | 'invalid_guest' | 'not_owned', total,
// used, remaining }.

export const runtime = 'nodejs';

const MAX_BYTES = 12_000_000; // 12 MB — a phone JPEG is well under this

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  const admin = createAdminClient();

  // Pre-check the quota so we don't PUT an object that the RPC would then
  // reject — keeps R2 free of orphans for the common exhausted case. The RPC's
  // advisory-locked count is still the authoritative gate for the boundary.
  const pre = await fetchGuestQuota(admin, session.event_id, session.guest_id);
  if (pre.remaining <= 0) {
    return NextResponse.json({ status: 'quota_exhausted', ...pre }, { status: 409 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `papic/guest/${session.guest_id}/papic-${Date.now()}.jpg`;
  try {
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: bytes,
      contentType: 'image/jpeg',
    });
  } catch {
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }
  const r2Ref = `r2://${R2_BUCKETS.media}/${key}`;

  const { data, error } = await admin.rpc('papic_record_guest_capture', {
    p_guest_id: session.guest_id,
    p_r2_object_key: r2Ref,
  });
  if (error) {
    return NextResponse.json({ error: 'record_failed' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    status?: string;
    total?: number;
    used?: number;
    remaining?: number;
  };

  if (result.status === 'ok') {
    // Auto-sync this guest capture into the couple's Google Drive (Phase 2).
    // Enqueue only — /api/cron/drive-copy-tick does the R2->Drive copy; no-op
    // until Drive is connected. Best-effort; dedup is per r2_object_key.
    try {
      await enqueueDriveCopy({
        eventId: session.event_id,
        artifactType: 'papic',
        files: [
          {
            r2ObjectKey: r2Ref,
            fileName: key.split('/').pop() || 'papic.jpg',
            mimeType: 'image/jpeg',
            sourceTable: 'papic_photos',
          },
        ],
      });
    } catch {
      // best-effort
    }
    return NextResponse.json(result);
  }
  return NextResponse.json(result, {
    status: result.status === 'quota_exhausted' ? 409 : 400,
  });
}
