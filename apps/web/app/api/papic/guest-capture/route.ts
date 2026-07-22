import { NextResponse, after } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { ingestToWall } from '@/lib/live-wall';
import { papicCaptureCost, resolvePointsGate } from '@/lib/papic-cameras';
import { enqueueDriveCopy, runDriveCopyBatch } from '@/lib/drive-copy';
import { screenCapture } from '@/lib/nsfw-screen';

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
// A 5-second 1080p phone clip is comfortably under this; oversized uploads are
// rejected before any R2 round-trip.
const MAX_CLIP_BYTES = 25_000_000; // ~25 MB
// 5-SECOND HARD CAP — corpus lock, not configurable. The route rejects a client
// that stamps a longer duration; the RPC ALSO clamps with LEAST(ms,5000).
const MAX_CLIP_MS = 5000;

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

  // media_type: 'photo' (default · JPEG path) | 'clip' (a guest-recorded ≤5s
  // video — Option A, the path that feeds the Alaala orb). The branch governs
  // the MIME allow-list, size cap, R2 key, and the poster/duration the clip
  // carries. An absent/unknown value → 'photo' so the original path is exact.
  const mediaType = form.get('media_type') === 'clip' ? 'clip' : 'photo';
  const isClip = mediaType === 'clip';

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (isClip) {
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'bad_type' }, { status: 415 });
    }
    if (file.size > MAX_CLIP_BYTES) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }
  } else {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'bad_type' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  // Clip extras (clip path only): the client-stamped duration (5s hard cap, also
  // re-clamped in the RPC) and the poster frame — the NSFW-screen proxy (nsfwjs
  // is image-only; we never classify the video bytes). A posterless clip stays
  // 'unscreened' (excluded from guest surfaces structurally).
  let durationMs: number | null = null;
  let posterBytes: Uint8Array | undefined;
  if (isClip) {
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
    const posterFile = form.get('poster');
    if (
      posterFile instanceof File &&
      posterFile.type.startsWith('image/') &&
      posterFile.size > 0 &&
      posterFile.size <= 5_000_000
    ) {
      posterBytes = new Uint8Array(await posterFile.arrayBuffer());
    }
  }

  // GUEST public-sharing opt-in (Alaala orb gate · RA 10173 explicit consent).
  // The capture UI sends 'share_publicly' = '1' ONLY when the guest ticked the
  // opt-in for THIS shot; absent/anything-else → false. This sets
  // consent_to_public on the row this guest captures (their own recording) —
  // one of the two gates the public showcase requires (the other is the
  // couple's approval). Default OFF: a missing flag never opts a guest in.
  const sharePublicly = form.get('share_publicly') === '1';

  // Optional on-device face descriptors (best-effort) — the phone detected faces
  // + computed their 128-d vectors and sent only those; the face IMAGE stayed on
  // the device. Parsed defensively: a malformed/oversized field just disables
  // auto-tag for this shot, never rejects the capture. Absent entirely until a
  // face model is hosted (NEXT_PUBLIC_FACE_MODEL_URL).
  let faceVectors: number[][] = [];
  const fvRaw = form.get('face_vectors');
  if (typeof fvRaw === 'string' && fvRaw.length > 0 && fvRaw.length < 200_000) {
    try {
      const parsed = JSON.parse(fvRaw);
      if (Array.isArray(parsed)) {
        faceVectors = parsed.filter(
          (v): v is number[] =>
            Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number'),
        );
      }
    } catch {
      faceVectors = [];
    }
  }

  // Optional dominant-face center (normalized 0..1) from the SAME on-device pass
  // — Tier-2 auto-reframe. Parsed defensively; anything out of [0,1] is ignored.
  let subjectCenterX: number | null = null;
  let subjectCenterY: number | null = null;
  {
    const sx = Number(form.get('subject_center_x'));
    const sy = Number(form.get('subject_center_y'));
    if (Number.isFinite(sx) && Number.isFinite(sy) && sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) {
      subjectCenterX = sx;
      subjectCenterY = sy;
    }
  }

  const admin = createAdminClient();

  // UGC moderation pre-checks (Apple 1.2 / Google Play UGC) — cheap reads that
  // keep R2 free of orphan objects we'd only reject. The capture RPC re-checks
  // both authoritatively (it's the real gate); these just short-circuit the
  // common rejected cases before the R2 PUT.
  const [{ data: blockRow }, { data: guestRow }] = await Promise.all([
    admin
      .from('event_blocked_users')
      .select('id')
      .eq('event_id', session.event_id)
      .eq('blocked_guest_id', session.guest_id)
      .maybeSingle(),
    admin
      .from('guests')
      .select('ugc_terms_accepted_at')
      .eq('guest_id', session.guest_id)
      .maybeSingle(),
  ]);
  if (blockRow) {
    return NextResponse.json({ status: 'blocked' }, { status: 403 });
  }
  if (!guestRow?.ugc_terms_accepted_at) {
    return NextResponse.json({ status: 'terms_required' }, { status: 403 });
  }

  // The capture's point cost (1 photo · 3 clip) — the ONE currency the shared
  // event pool meters (Free / Papic One / Papic Pool all draw the same pool).
  const cost = papicCaptureCost(isClip ? 'clip' : 'photo');

  // Pre-check the shared event pool so we don't PUT an object the reserve would
  // then refuse — keeps R2 free of orphans for the common exhausted case. The
  // AUTHORITATIVE, race-safe gate is the papic_reserve_event_points reserve
  // below (fail-CLOSED). This pre-check fails OPEN by design: a non-applies
  // event (no grant / no pass) returns MAXINT so this is a no-op and the record
  // RPC's own gate decides (legacy behaviour byte-identical), and any RPC error
  // just skips the optimization — the reserve still gates.
  {
    const { data: remaining, error: remErr } = await admin.rpc(
      'papic_event_points_remaining',
      { p_event_id: session.event_id },
    );
    if (!remErr && typeof remaining === 'number' && remaining < cost) {
      return NextResponse.json({ status: 'camera_points_exhausted' }, { status: 409 });
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stamp = Date.now();
  // Clip → .mp4 (video/mp4); photo → .jpg (image/jpeg). The poster (if present)
  // rides a sibling .jpg key so the NSFW screen + clip thumbnail can find it.
  const key = isClip
    ? `papic/guest/${session.guest_id}/papic-${stamp}.mp4`
    : `papic/guest/${session.guest_id}/papic-${stamp}.jpg`;
  try {
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: bytes,
      contentType: isClip ? 'video/mp4' : 'image/jpeg',
    });
  } catch {
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }
  const r2Ref = `r2://${R2_BUCKETS.media}/${key}`;

  // Upload the clip's poster frame (best-effort). A failed/absent poster just
  // leaves the clip 'unscreened' (excluded from guest surfaces) — it never fails
  // the capture.
  let posterRef: string | null = null;
  if (isClip && posterBytes) {
    const posterKey = `papic/guest/${session.guest_id}/papic-${stamp}-poster.jpg`;
    try {
      await r2Upload({
        bucket: R2_BUCKETS.media,
        key: posterKey,
        body: posterBytes,
        contentType: 'image/jpeg',
      });
      posterRef = `r2://${R2_BUCKETS.media}/${posterKey}`;
    } catch {
      posterRef = null;
    }
  }

  // ── EVENT-POOL reserve (Phase 0c uniform gate) — the AUTHORITATIVE, race-safe
  // cap for every guest capture. Free / Papic One / Papic Pool all draw this one
  // shared pool; papic_reserve_event_points atomically books `cost` points (or
  // allows unconditionally on a non-applies event, ledger untouched). Same
  // fail-CLOSED posture as the seat path (papic/actions.ts): block on any RPC
  // error EXCEPT function-not-found (the seam-cutover carve-out in
  // resolvePointsGate). A refused reserve unwinds below if the record then fails.
  let eventBooked = false;
  {
    const { data: poolOk, error: poolErr } = await admin.rpc(
      'papic_reserve_event_points',
      { p_event_id: session.event_id, p_cost: cost },
    );
    const gate = resolvePointsGate(
      poolErr ? (poolErr.code ?? 'unknown') : null,
      poolOk === true ? true : poolOk === false ? false : null,
    );
    // Only a TRUE actually spent points — a fn-not-found 'allow' booked nothing.
    eventBooked = poolOk === true;
    if (gate === 'exhausted') {
      return NextResponse.json({ status: 'camera_points_exhausted' }, { status: 409 });
    }
    if (gate === 'blocked') {
      return NextResponse.json({ status: 'points_check_failed' }, { status: 503 });
    }
  }

  // Record the capture, carrying the guest's public-share consent + (for clips)
  // media_type + duration + poster on the row. Graceful-degrade: if the extended
  // RPC isn't deployed yet, retry the 3-arg then the 2-arg signature so the
  // capture still records — clip extras just can't persist until the migration
  // lands (a degraded clip records as a photo-typed row, never silently shared).
  let { data, error } = await admin.rpc('papic_record_guest_capture', {
    p_guest_id: session.guest_id,
    p_r2_object_key: r2Ref,
    p_consent_to_public: sharePublicly,
    p_media_type: mediaType,
    p_duration_ms: durationMs,
    p_poster_r2_key: posterRef,
  });
  if (error && /p_media_type|p_duration_ms|p_poster_r2_key|function .*papic_record_guest_capture/i.test(error.message ?? '')) {
    ({ data, error } = await admin.rpc('papic_record_guest_capture', {
      p_guest_id: session.guest_id,
      p_r2_object_key: r2Ref,
      p_consent_to_public: sharePublicly,
    }));
    if (error && /p_consent_to_public|function .*papic_record_guest_capture/i.test(error.message ?? '')) {
      ({ data, error } = await admin.rpc('papic_record_guest_capture', {
        p_guest_id: session.guest_id,
        p_r2_object_key: r2Ref,
      }));
    }
  }

  // If the record failed OR came back non-ok (quota_exhausted / not_owned /
  // invalid_guest), unwind the pool reservation so a refused capture never
  // leaves points spent — symmetric to the seat path. Best-effort; a failed
  // unwind costs the couple points, never a broken capture.
  const recordStatus = (data as { status?: string } | null)?.status;
  if ((error || recordStatus !== 'ok') && eventBooked) {
    await admin
      .rpc('papic_release_event_points', {
        p_event_id: session.event_id,
        p_cost: cost,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  }
  if (error) {
    return NextResponse.json({ error: 'record_failed' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    status?: string;
    total?: number;
    used?: number;
    remaining?: number;
  };

  let captureId: string | null = null;
  if (result.status === 'ok') {
    // Resolve the new capture's id (the RPC reports quota only) — the Kwento
    // author sheet anchors on it, and the wall ingest below reuses it.
    try {
      const { data: capRow } = await admin
        .from('papic_guest_captures')
        .select('capture_id')
        .eq('r2_object_key', r2Ref)
        .maybeSingle();
      captureId = (capRow?.capture_id as string) ?? null;
    } catch {
      captureId = null;
    }
  }

  // Persist the dominant-face center for Tier-2 auto-reframe (best-effort,
  // additive; the Stories render falls back to a centered focal when absent).
  if (captureId && subjectCenterX !== null && subjectCenterY !== null) {
    try {
      await admin
        .from('papic_guest_captures')
        .update({ subject_center_x: subjectCenterX, subject_center_y: subjectCenterY })
        .eq('capture_id', captureId);
    } catch {
      // best-effort — never blocks the capture
    }
  }

  if (result.status === 'ok') {
    // Always-on NSFW screen (Apple 1.2 filter · corpus hard constraint) — runs
    // in the BACKGROUND with after() so the shutter stays instant. We already
    // hold the JPEG bytes, so no R2 round-trip. Fail-open: any classifier error
    // leaves the row 'unscreened' and the photo flows normally.
    // Salamisim chain: screen FIRST (the wall is an allowlist — only 'clean'
    // projects), THEN the wall gate. The capture RPC doesn't return the row
    // id, so resolve it by the (unique) r2 ref before ingesting.
    after(async () => {
      // Per-event fidelity tier (brief PR-4): the ingest READ seam of the
      // single `events.papic_quality_tier` column the setup surface writes.
      // Runs FIRST so derivatives / Drive / downloads flow from the tiered
      // original. STILLS only; full_res / legacy / pre-migration rows are a
      // strict no-op. Best-effort — the module never throws. (The NSFW screen
      // below classifies the in-memory bytes, so it is unaffected either way.)
      if (!isClip) {
        try {
          const { applyEventFidelityToOriginal } = await import(
            '@/lib/papic-ingest-fidelity'
          );
          await applyEventFidelityToOriginal(session.event_id, r2Ref);
        } catch {
          // best-effort — fidelity never breaks a capture
        }
      }
      // screenCapture classifies the image proxy: photo bytes directly, or — for
      // a clip — it swaps to the row's poster_r2_key and reads that from R2 (the
      // video bytes are never classified). So we hand it the photo bytes; for a
      // clip the helper resolves the poster on its own. A posterless clip stays
      // 'unscreened' (excluded from guest surfaces).
      await screenCapture({
        table: 'papic_guest_captures',
        r2ObjectKey: r2Ref,
        bytes: isClip ? undefined : bytes,
      }).catch(() => {});
      // Cheap display + thumbnail derivatives (best-effort, AFTER the screen)
      // so guest/owner galleries serve compressed tiles instead of full-res
      // originals. Dynamic import keeps the sharp/R2 cost off the shutter hot
      // path; the module wraps everything (never throws). Clips have no
      // transcode — derive the thumb from the poster.
      if (captureId) {
        try {
          const { generatePhotoDerivatives, generateClipThumb } = await import(
            '@/lib/papic-derivatives'
          );
          if (isClip) {
            if (posterRef) {
              await generateClipThumb(posterRef, 'papic_guest_captures', 'capture_id', captureId);
            }
          } else {
            await generatePhotoDerivatives(r2Ref, 'papic_guest_captures', 'capture_id', captureId);
          }
        } catch {
          // best-effort — derivatives never break a capture
        }
      }
      try {
        if (captureId) {
          // P2 FaceBlock bake sits between the screen and the wall gate: on
          // a FaceBlock event the ingest withholds un-baked rows, so the blur
          // derivative must exist first. Cheap no-op on non-FaceBlock /
          // non-LIVE_WALL events; FAILS CLOSED (no markers, photo stays off
          // the wall) on any error.
          const { bakeFaceBlurForCapture } = await import('@/lib/face-blur');
          await bakeFaceBlurForCapture({
            table: 'papic_guest_captures',
            sourceId: captureId,
          });
          await ingestToWall('papic_guest_captures', captureId);
        }
      } catch {
        // best-effort — the wall reconcile never blocks a capture
      }
      // FACE auto-tag (best-effort) — match the on-device descriptors against the
      // event's CONSENTED enrollments and write auto_face tags on this guest
      // capture. Runs regardless of the wall gate; the small guest vectors are
      // read only here and never leave our server. Dormant until enrollments
      // carry vectors (no enrolled vectors → clean no-op). QR scan is the manual
      // fallback either way.
      if (captureId && faceVectors.length > 0) {
        try {
          const { autoTagCapture } = await import('@/lib/face-match');
          await autoTagCapture({
            eventId: session.event_id,
            sourceTable: 'papic_guest_captures',
            photoId: captureId,
            faceVectors,
          });
        } catch {
          // best-effort — face tagging never affects the saved photo
        }
      }
    });
    // Auto-sync this guest capture into the couple's Google Drive (Phase 2),
    // cron-free: enqueue the artifact, then copy it in the BACKGROUND with
    // after() so the response returns immediately. No-op until Drive is
    // connected; best-effort; dedup is per drive_copy_artifacts.r2_object_key.
    try {
      await enqueueDriveCopy({
        eventId: session.event_id,
        artifactType: 'papic',
        files: [
          {
            r2ObjectKey: r2Ref,
            fileName: key.split('/').pop() || (isClip ? 'papic.mp4' : 'papic.jpg'),
            mimeType: isClip ? 'video/mp4' : 'image/jpeg',
            sourceTable: 'papic_photos',
          },
        ],
      });
      after(() =>
        runDriveCopyBatch({ eventId: session.event_id }).catch(() => {}),
      );
    } catch {
      // best-effort
    }
    return NextResponse.json({ ...result, captureId });
  }
  return NextResponse.json(result, {
    status: result.status === 'quota_exhausted' ? 409 : 400,
  });
}
