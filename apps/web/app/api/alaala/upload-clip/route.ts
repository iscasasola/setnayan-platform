import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';

// POST /api/alaala/upload-clip
//
// Couple uploads a short (≤ 5 s) video clip into the Alaala orb.
// Accepts multipart/form-data with fields:
//   file       — the video file (mp4, webm, mov, quicktime)
//   event_id   — UUID of the couple's event
//   duration_ms — client-reported duration in ms (integer, enforced ≤ 5500)
//
// Returns: { clip_id, r2_key }

export const runtime = 'nodejs';

const MAX_BYTES = 50_000_000; // 50 MB — generous for a 5 s clip
const MAX_DURATION_MS = 5500; // 5 s hard cap (500 ms grace for encoding overhead)
const ALLOWED_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/mov']);

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  // ── Parse form ────────────────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const file = form.get('file');
  const eventId = form.get('event_id');
  const durationMsRaw = form.get('duration_ms');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (typeof eventId !== 'string' || !eventId) {
    return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });
  }

  const durationMs = Number(durationMsRaw);
  if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
    return NextResponse.json(
      { error: 'invalid_duration', max_ms: MAX_DURATION_MS },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'unsupported_type', accepted: [...ALLOWED_TYPES] }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large', max_bytes: MAX_BYTES }, { status: 413 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  // ── Verify event ownership ────────────────────────────────────────────────
  // Use the user-scoped client so RLS enforces ownership.
  const { data: eventRow, error: eventErr } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .single();

  if (eventErr || !eventRow) {
    return NextResponse.json({ error: 'not_found_or_forbidden' }, { status: 403 });
  }

  // ── Upload to R2 ──────────────────────────────────────────────────────────
  const ext = file.type === 'video/webm' ? 'webm' : 'mp4';
  const key = `alaala/couple/${eventId}/${randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: bytes,
      contentType: file.type,
    });
  } catch {
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }

  // ── Insert DB record ──────────────────────────────────────────────────────
  // Use admin client for the insert because the RLS SELECT policy on alaala_clips
  // uses current_event_ids() which requires a loaded session; the FormData upload
  // flow goes through the user client auth check above and then writes via admin
  // to avoid cookie-session unavailability in the Node runtime.
  const admin = createAdminClient();
  const { data: clip, error: dbErr } = await admin
    .from('alaala_clips')
    .insert({
      event_id: eventId,
      source: 'couple_upload',
      r2_object_key: key,
      duration_ms: durationMs,
      // Couple uploads are self-consented — both flags pre-approved.
      consent_to_public: true,
      couple_approved_for_showcase: true,
      uploaded_by_user_id: user.id,
    })
    .select('id, r2_object_key')
    .single();

  if (dbErr || !clip) {
    return NextResponse.json({ error: 'db_failed' }, { status: 500 });
  }

  return NextResponse.json({ clip_id: clip.id, r2_key: clip.r2_object_key });
}
