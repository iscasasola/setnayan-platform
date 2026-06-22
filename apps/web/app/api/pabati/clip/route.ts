import { NextResponse, after } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { fetchPabatiQuota, screenPabatiClipPoster } from '@/lib/pabati';
import { enqueueDriveCopy, runDriveCopyBatch } from '@/lib/drive-copy';

// POST /api/pabati/clip
//
// The clip-recording endpoint for PABATI (the guest video-greeting collector).
// Mirrors /api/papic/guest-capture, swapping photo → video.
//
// Two submitter identities are accepted:
//   1. A GUEST via the setnayan_guest_session cookie (no sign-in — the zero-
//      account model). guest_id + event_id come from the cookie.
//   2. An AUTHENTICATED couple/coordinator (auth.uid()), who may record their
//      own greeting from a dashboard surface. They pass event_id in the form;
//      membership is verified against event_members.
//
// The whole capture happens server-side: validate the submitter, validate the
// video (type + size + the 5-SECOND HARD CAP via the client-stamped
// duration_ms), pre-check the 300-clip per-event quota (to keep R2 free of
// orphans), PUT the MP4 to R2 with the service-role client, then record it
// through the SECURITY DEFINER pabati_record_clip RPC, which atomically
// re-checks ownership + the cap + re-clamps the duration to ≤5s. The NSFW
// screen (corpus lock: on by default, cannot disable) runs in an after() block
// over the client-extracted poster frame.
//
// Returns { status: 'ok' | 'quota_exhausted' | 'not_owned', total, used,
// remaining, clipId? }.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A 5-second 1080p phone clip is comfortably under this; oversized uploads are
// rejected before any R2 round-trip.
const MAX_BYTES = 25_000_000; // ~25 MB

// 5-SECOND HARD CAP — corpus lock, not configurable. The route rejects a
// client that stamps a longer duration; the RPC ALSO clamps with LEAST(ms,5000)
// as defense in depth.
const MAX_CLIP_MS = 5000;

export async function POST(req: Request) {
  // ── Identity ──────────────────────────────────────────────────────────
  // Prefer the guest session (the common path); fall back to an authenticated
  // couple/coordinator. Resolve eventId + (optional) guestId from whichever
  // identity is present.
  const guestSession = await readGuestSession();

  let eventId: string | null = null;
  let guestId: string | null = null;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  if (guestSession) {
    eventId = guestSession.event_id;
    guestId = guestSession.guest_id;
  } else {
    // Authenticated couple/coordinator path — event_id comes from the form and
    // is authorized against event_members. No guest_id (the clip is the couple's
    // own greeting; guest_id stays NULL = un-identified-by-guest).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'no_session' }, { status: 401 });
    }
    const formEventId = form.get('event_id');
    if (typeof formEventId !== 'string' || formEventId.length === 0) {
      return NextResponse.json({ error: 'no_event' }, { status: 400 });
    }
    const { data: membership } = await supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', formEventId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (
      !membership ||
      (membership.member_type !== 'couple' &&
        membership.member_type !== 'coordinator')
    ) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    eventId = formEventId;
  }

  if (!eventId) {
    return NextResponse.json({ error: 'no_event' }, { status: 400 });
  }

  // ── Validate the video ────────────────────────────────────────────────
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (!file.type.startsWith('video/')) {
    return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // 5-SECOND HARD CAP enforced server-side: reject a client that stamps a
  // longer clip. (The RPC also clamps; a missing/blank duration is allowed —
  // the RPC stores it as unknown.)
  let durationMs: number | null = null;
  const durRaw = form.get('duration_ms');
  if (typeof durRaw === 'string' && durRaw.length > 0) {
    const parsed = Number.parseInt(durRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      if (parsed > MAX_CLIP_MS) {
        return NextResponse.json({ error: 'too_long' }, { status: 400 });
      }
      durationMs = parsed;
    }
  }

  const guestLabelRaw = form.get('guest_label');
  const guestLabel =
    typeof guestLabelRaw === 'string' && guestLabelRaw.trim().length > 0
      ? guestLabelRaw.trim().slice(0, 120)
      : null;

  // Optional client-extracted poster frame (a JPEG) — the screening proxy for
  // the clip (nsfwjs is image-only; the lambda has no ffmpeg). Best-effort:
  // absent until the collector UI extracts it, and an absent poster just leaves
  // the clip 'unscreened' (excluded structurally from guest surfaces).
  const posterFile = form.get('poster');
  let posterBytes: Uint8Array | undefined;
  if (
    posterFile instanceof File &&
    posterFile.type.startsWith('image/') &&
    posterFile.size > 0 &&
    posterFile.size <= 5_000_000
  ) {
    posterBytes = new Uint8Array(await posterFile.arrayBuffer());
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  const admin = createAdminClient();

  // ── Quota pre-check ───────────────────────────────────────────────────
  // Avoid PUTting an object the RPC would reject — keeps R2 free of orphans for
  // the common exhausted case. The RPC's advisory-locked count is still the
  // authoritative gate at the boundary.
  const pre = await fetchPabatiQuota(admin, eventId);
  if (pre.remaining <= 0) {
    return NextResponse.json({ status: 'quota_exhausted', ...pre }, { status: 409 });
  }

  // ── Upload the clip to R2 ─────────────────────────────────────────────
  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `pabati/${eventId}/pabati-${Date.now()}.mp4`;
  try {
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: bytes,
      contentType: 'video/mp4',
    });
  } catch {
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }
  const r2Ref = `r2://${R2_BUCKETS.media}/${key}`;

  // ── Record via the quota + cap RPC ────────────────────────────────────
  const { data, error } = await admin.rpc('pabati_record_clip', {
    p_event_id: eventId,
    p_guest_id: guestId,
    p_r2_object_key: r2Ref,
    p_duration_ms: durationMs,
    p_guest_label: guestLabel,
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

  if (result.status !== 'ok') {
    return NextResponse.json(result, {
      status: result.status === 'quota_exhausted' ? 409 : 400,
    });
  }

  // Resolve the new clip's id (the RPC reports quota only) for the caller.
  let clipId: string | null = null;
  try {
    const { data: clipRow } = await admin
      .from('pabati_clips')
      .select('clip_id')
      .eq('r2_object_key', r2Ref)
      .maybeSingle();
    clipId = (clipRow?.clip_id as string) ?? null;
  } catch {
    clipId = null;
  }

  // ── NSFW screen (corpus lock — on by default, cannot disable) ─────────
  // Runs in the BACKGROUND so the response stays fast. Screens the poster
  // frame (the clip's image proxy); a posterless clip stays 'unscreened' and is
  // excluded from guest surfaces structurally. Fail-open inside the helper.
  after(async () => {
    await screenPabatiClipPoster({ clipR2Ref: r2Ref, posterBytes }).catch(() => {});
  });

  // ── Auto-sync into the couple's Google Drive (Phase 2) ────────────────
  // Cron-free: enqueue the artifact, then copy it in the BACKGROUND. No-op
  // until Drive is connected; best-effort; dedup per r2_object_key.
  try {
    await enqueueDriveCopy({
      eventId,
      artifactType: 'pabati',
      files: [
        {
          r2ObjectKey: r2Ref,
          fileName: key.split('/').pop() || 'pabati.mp4',
          mimeType: 'video/mp4',
          sourceTable: 'pabati_clips',
        },
      ],
    });
    after(() => runDriveCopyBatch({ eventId }).catch(() => {}));
  } catch {
    // best-effort
  }

  return NextResponse.json({ ...result, clipId });
}
