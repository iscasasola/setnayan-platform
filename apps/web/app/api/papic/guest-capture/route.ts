import { NextResponse, after } from 'next/server';
import { tellTheCouplePapicPoolIsSpent } from '@/lib/papic-pool-spent-notice';
import { eventAcceptsNewCaptures } from '@/lib/event-accepts-captures';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured } from '@/lib/r2';
import { enforceRateLimit, rateLimited429 } from '@/lib/with-rate-limit';
import {
  PAPIC_SEAT_BURST,
  PAPIC_SEAT_BURST_WINDOW_S,
} from '@/lib/papic-capture-ceiling';
import { guestCaptureGate, GUEST_CAPTURE_GATE_COLUMNS } from '@/lib/papic-guest-window';
import { ingestToWall } from '@/lib/live-wall';
import { papicCaptureCost } from '@/lib/papic-cameras';
import { papicEventPoolPreCheckExhausted } from '@/lib/papic-event-pool-gate';
import { resolveGuestOwnCamera } from '@/lib/papic-guest-own-camera';
import { enqueueDriveCopy, runDriveCopyBatch } from '@/lib/drive-copy';
import { screenCapture } from '@/lib/nsfw-screen';
import { clipWebKeyDistinct } from '@/lib/papic-display-ref';
import { capturedAtIso, parseCapturedAtMs } from '@/lib/papic-capture-minute';
import { CLIENT_CAPTURE_ID_FIELD, readClientCaptureId } from '@/lib/papic-client-capture-id';
import {
  eventKeepsFullRes,
  readCaptureIntents,
  screenTierBytes,
  settleCaptureIntents,
  signCaptureTierPut,
  discardFinalObjects,
  dropStagingObjects,
  loadUploadedTiers,
  promoteTier,
  type IntentRow,
} from '@/lib/papic-upload-intents.server';
import { isCaptureTier, tiersFor, type CaptureTier } from '@/lib/papic-upload/tiers';

// POST /api/papic/guest-capture
//
// The guest-camera capture endpoint for PAPIC_GUEST. The guest is identified by
// their setnayan_guest_session cookie (guest_id + event_id) — no sign-in, so
// /api/upload (which 401s anonymous callers) can't be used.
//
// ── 🚫 NO FILE BYTES COME THROUGH HERE (2026-10-23) ─────────────────────────
// MEASURED in production: a 6 MB POST to this route answered 413
// FUNCTION_PAYLOAD_TOO_LARGE from Vercel before this code ran — a Vercel
// function refuses any request body over 4.5 MB, and a 10-second guest clip is
// designed at ~12.5 MB, so EVERY normal clip failed. This route now takes a
// small JSON body only; a multipart body is refused (415 bytes_not_accepted).
// The phone saves a shot first (IndexedDB) and sends it later in pieces, each
// PUT straight to R2 on a URL minted here (lib/papic-upload/). Three ops:
//
//   sign   — "may I upload this piece?" Checks the session, the terms, the
//            window, put-away and the credits BEFORE minting one presigned PUT
//            for one tier of one shot (key bound to the clientCaptureId + tier,
//            Content-Type + Content-Length signed, minutes to live).
//   record — the shot's first piece landed (photo: its thumbnail · clip: its
//            poster + first playable). Verify the objects, then the SAME one
//            transaction as before books the points and writes the row
//            (papic_record_guest_capture_and_spend). Screened before answering.
//   attach — a later piece landed (tile + display, the original, a clip's raw).
//            Verified and SCREENED before its key is written onto the row, so
//            nothing reaches another person unscreened.
//
// Guarded by lib/papic-upload/no-capture-route-takes-file-bytes.test.ts.
// Returns the same statuses the camera always read: 'ok' | 'quota_exhausted' |
// 'camera_points_exhausted' | 'event_put_away' | 'blocked' | 'terms_required' …

export const runtime = 'nodejs';

// 10-SECOND CLIP CAP — owner 2026-07-22 · §0. The route rejects a client that
// stamps a longer duration; the RPC ALSO clamps with LEAST(ms,10000).
const MAX_CLIP_MS = 10000;

// The JSON body carries at most the on-device face vectors (mode_a events) —
// 200 KB covers dozens of 128-d descriptors; anything bigger is not ours.
const MAX_JSON_BYTES = 256_000;

type GuestSession = NonNullable<Awaited<ReturnType<typeof readGuestSession>>>;
type Admin = ReturnType<typeof createAdminClient>;

type CaptureRow = {
  capture_id: string;
  media_type: string | null;
  r2_object_key: string | null;
  poster_r2_key: string | null;
  display_r2_key: string | null;
  tile_r2_key: string | null;
  thumb_r2_key: string | null;
  clip_web_r2_key: string | null;
  moderation_state: string | null;
};

type Body = Record<string, unknown>;

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

// ── WHEN may this guest shoot? (owner 2026-08-07) ──────────────────────────
// Default: the event day only. If the host pressed "let guests shoot now",
// the event's whole Papic window. Guests previously had NO time gate at all —
// the pass check asks only WHETHER the event has guest cameras, never WHEN —
// so someone who redeemed their invite months early could shoot into the
// couple's gallery on any random Tuesday.
//
// 🔑 THIS IS THE ENFORCEMENT. The guest page hides the camera too, but a page
// is a courtesy: this route is reachable directly and the RPC behind it checks
// ownership and quota, never time.
//
// ⚠ Asked for a NEW shot only (sign before record, and record). A piece that
// follows a shot we already accepted (attach, or a sign after record) is never
// refused because the day has since rolled over — that would strand the row
// with no display copy.
async function windowRefusal(session: GuestSession, admin: Admin): Promise<NextResponse | null> {
  const { data: gateRow, error: gateErr } = await admin
    .from('events')
    .select(GUEST_CAPTURE_GATE_COLUMNS)
    .eq('event_id', session.event_id)
    .maybeSingle();
  if (gateErr) console.error('[supabase-error] app/api/papic/guest-capture/route.ts · from:events.select', gateErr);

  // ⚠ Supabase RESOLVES with { error }, it does not throw. A phantom column
  // here would return null and read exactly like "no event" — so an unreadable
  // row must not be treated as a refusal. Fail OPEN on a read failure: the
  // pass check and the quota still bound this, and silently refusing a guest
  // at a live wedding is the worse outcome.
  if (!gateErr && gateRow) {
    const gate = guestCaptureGate({
      earlyAllowed: gateRow.papic_guest_capture_early,
      eventDate: gateRow.event_date,
      windowStart: gateRow.papic_window_start,
      windowEnd: gateRow.papic_window_end,
    });
    if (gate.state !== 'open') {
      return json(
        {
          error: gate.state === 'not_open_yet' ? 'guest_capture_not_open_yet' : 'guest_capture_closed',
          eventDay: gate.eventDay,
        },
        403,
      );
    }
  }
  return null;
}

// UGC moderation pre-checks (Apple 1.2 / Google Play UGC) — cheap reads that
// keep R2 free of objects we'd only reject. The capture RPC re-checks both
// authoritatively (it's the real gate).
async function moderationRefusal(session: GuestSession, admin: Admin): Promise<NextResponse | null> {
  const [{ data: blockRow }, { data: guestRow }] = await Promise.all([
    admin
      .from('event_blocked_users')
      .select('id')
      .eq('event_id', session.event_id)
      .eq('blocked_guest_id', session.guest_id)
      .maybeSingle(),
    admin.from('guests').select('ugc_terms_accepted_at').eq('guest_id', session.guest_id).maybeSingle(),
  ]);
  if (blockRow) return json({ status: 'blocked' }, 403);
  if (!guestRow?.ugc_terms_accepted_at) return json({ status: 'terms_required' }, 403);
  return null;
}

// ── PUT AWAY = the shutter stops (owner 2026-08-16) ────────────────────────
// Fails OPEN on an unreadable row — see the helper for why a read failure must
// never stop a live celebration's cameras.
//
// ── DOES THIS GUEST HOLD SHOTS THEY BOUGHT? (2026-08-02) ───────────────────
// A guest who bought their own shots has a camera of their own with a
// dedicated balance. Resolved here for the pre-check only: which ledger a shot
// is BOOKED against is decided inside the one-transaction record.
//
// ⚠ Gated on `dedicated > 0` and nothing else: a guest whose camera holds
// nothing of her own left draws the pot like everyone else.
async function creditRefusal(
  session: GuestSession,
  admin: Admin,
  cost: number,
): Promise<NextResponse | null> {
  if (!(await eventAcceptsNewCaptures(admin, session.event_id))) {
    return json({ status: 'event_put_away' }, 409);
  }
  const ownCamera = await resolveGuestOwnCamera(admin, session.event_id, session.guest_id);
  const spendOwn = (ownCamera?.dedicated ?? 0) > 0;
  // Skipped for a guest spending their OWN points: the shared pool being
  // empty is exactly the situation they bought their way out of.
  if (
    !spendOwn &&
    (await papicEventPoolPreCheckExhausted(admin, session.event_id, cost))
  ) {
    // ⬇ THE COUPLE ARE THE ONLY PEOPLE WHO CAN ACT ON THIS. Deduped inside;
    // after() so the refusal is not delayed.
    after(async () => {
      await tellTheCouplePapicPoolIsSpent(session.event_id);
    });
    return json({ status: 'camera_points_exhausted' }, 409);
  }
  return null;
}

function parseDuration(body: Body): { ok: true; ms: number | null } | { ok: false } {
  const raw = body.duration_ms;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return { ok: true, ms: null };
  if (n > MAX_CLIP_MS) return { ok: false };
  return { ok: true, ms: Math.round(n) };
}

function intentFor(intents: readonly IntentRow[], tier: CaptureTier): IntentRow | undefined {
  return intents.find((i) => i.tier === tier);
}

type Loaded = Awaited<ReturnType<typeof loadUploadedTiers>>['loaded'][number];

/**
 * Read + check the pieces the phone says it uploaded, or a 409 naming the ones
 * it must PUT (again). Nothing is promoted here — the caller screens first.
 */
async function loadOrRedo(
  intents: readonly IntentRow[],
  tiers: readonly CaptureTier[],
): Promise<{ ok: true; byTier: Map<CaptureTier, Loaded> } | { ok: false; res: NextResponse }> {
  const missing = tiers.filter((t) => !intentFor(intents, t));
  if (missing.length > 0) {
    return { ok: false, res: json({ error: 'object_missing', missing }, 409) };
  }
  const { loaded, redo } = await loadUploadedTiers(tiers.map((t) => intentFor(intents, t)!));
  if (redo.length > 0) {
    return { ok: false, res: json({ error: 'object_rejected', missing: redo }, 409) };
  }
  return { ok: true, byTier: new Map(loaded.map((l) => [l.intent.tier, l])) };
}

/** Promote every loaded piece to its final key; answers tier → final ref. */
async function promoteAll(
  byTier: Map<CaptureTier, Loaded>,
): Promise<Map<CaptureTier, string> | null> {
  try {
    const out = new Map<CaptureTier, string>();
    for (const [tier, loaded] of byTier) out.set(tier, await promoteTier(loaded));
    return out;
  } catch (err) {
    console.error('[papic-upload] promote failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── sign ────────────────────────────────────────────────────────────────────
async function handleSign(
  session: GuestSession,
  admin: Admin,
  body: Body,
  clientCaptureId: string,
  mediaType: 'photo' | 'clip',
  prior: CaptureRow | null,
): Promise<NextResponse> {
  const tier = body.tier;
  if (!isCaptureTier(tier) || !tiersFor(mediaType).includes(tier)) {
    return json({ error: 'bad_tier' }, 400);
  }
  const contentType = typeof body.content_type === 'string' ? body.content_type : '';
  const sizeBytes = typeof body.size_bytes === 'number' ? body.size_bytes : NaN;

  if (prior) {
    // A piece that FOLLOWS an accepted shot: no window, no credits — the shot
    // is already paid for. Only what is still missing on the row may be signed;
    // a piece the row already shows can never be overwritten (it was screened).
    if (tier === 'thumb' || tier === 'poster' || tier === 'clip_web') {
      return json({ status: 'ok', already: true });
    }
    if ((tier === 'tile' && prior.tile_r2_key) || (tier === 'display' && prior.display_r2_key)) {
      return json({ status: 'ok', already: true });
    }
    if (tier === 'original' || tier === 'clip_raw') {
      if (prior.r2_object_key?.includes(`-${tier}.`)) return json({ status: 'ok', already: true });
      if (!(await eventKeepsFullRes(admin, session.event_id))) {
        return json({ error: 'full_not_wanted' }, 409);
      }
    }
  } else {
    if (tier === 'tile' || tier === 'display') {
      // Never before the record: these pieces attach to a row. (An ORIGINAL may
      // come first — that is a phone that could not make a thumbnail, and its
      // original is the record's piece; see phaseOf in lib/papic-upload/tiers.ts.)
      return json({ error: 'not_recorded_yet' }, 409);
    }
    const duration = parseDuration(body);
    const refused =
      (await windowRefusal(session, admin)) ??
      (await moderationRefusal(session, admin)) ??
      (await creditRefusal(session, admin, papicCaptureCost(mediaType, duration.ok ? duration.ms : null)));
    if (refused) return refused;
  }

  const signed = await signCaptureTierPut(admin, {
    lane: 'guest',
    eventId: session.event_id,
    ownerId: session.guest_id,
    clientCaptureId,
    tier,
    contentType,
    sizeBytes,
  });
  if (!signed.ok) {
    return json({ error: signed.error }, signed.error === 'sign_failed' ? 503 : signed.error === 'too_large' ? 413 : 400);
  }
  return json({ status: 'ok', uploadUrl: signed.uploadUrl, expiresIn: signed.expiresInSeconds });
}

// ── record ──────────────────────────────────────────────────────────────────
async function handleRecord(
  session: GuestSession,
  admin: Admin,
  body: Body,
  clientCaptureId: string,
  mediaType: 'photo' | 'clip',
  prior: CaptureRow | null,
): Promise<NextResponse> {
  // 🔁 THIS SHUTTER ALREADY LANDED. The phone never heard "saved" (the answer
  // was lost on bad signal) and sent the record again. Answer with the first
  // row — asked of the RPC with the same id, which replies `duplicate` with the
  // guest's current figures and charges nothing — BEFORE any booking. A
  // duplicate that races past this read is caught again inside the RPC's lock.
  if (prior?.capture_id) {
    const { data: again } = await admin.rpc('papic_record_guest_capture', {
      p_guest_id: session.guest_id,
      p_client_capture_id: clientCaptureId,
    });
    return json({
      ...((again ?? {}) as Record<string, unknown>),
      status: 'ok',
      duplicate: true,
      captureId: prior.capture_id,
      wantFull: await eventKeepsFullRes(admin, session.event_id),
    });
  }

  const isClip = mediaType === 'clip';
  const duration = parseDuration(body);
  if (!duration.ok) return json({ error: 'too_long' }, 400);
  const durationMs = isClip ? duration.ms : null;

  const refusedEarly = (await windowRefusal(session, admin)) ?? (await moderationRefusal(session, admin));
  if (refusedEarly) return refusedEarly;

  // ⏱ THE SAME PER-CAMERA CEILING, on the guest door. Keyed on the guest, not
  // the event: 250 captures/second across an event is the product working; 12
  // from one phone is a loop. See PAPIC_SEAT_BURST for the reasoning.
  const burst = await enforceRateLimit('papic_guest_capture', session.guest_id, {
    limit: PAPIC_SEAT_BURST,
    windowSecs: PAPIC_SEAT_BURST_WINDOW_S,
  });
  if (!burst.ok) return rateLimited429(burst.retryAfterSecs);

  // The capture's point cost (1 photo · 7 clip) — the ONE currency the shared
  // event pool meters. An absent or unparseable duration falls to the top band.
  const cost = papicCaptureCost(isClip ? 'clip' : 'photo', durationMs);
  const refused = await creditRefusal(session, admin, cost);
  if (refused) return refused;

  // ── WHAT LANDED ────────────────────────────────────────────────────────
  const intents = await readCaptureIntents(admin, session.guest_id, clientCaptureId);
  if (!intents) return json({ error: 'record_failed' }, 503);
  const playable: CaptureTier = intentFor(intents, 'clip_web') ? 'clip_web' : 'clip_raw';
  // A photo records with its thumbnail — or, from a phone that could not make
  // one, with its original (the server then makes the copies, as it always did).
  const photoFirst: CaptureTier = intentFor(intents, 'thumb') ? 'thumb' : 'original';
  const needed: CaptureTier[] = isClip ? ['poster', playable] : [photoFirst];
  const checked = await loadOrRedo(intents, needed);
  if (!checked.ok) return checked.res;
  // Written to the FINAL keys before the row exists — the row is born pointing
  // at copies no presigned URL can reach (lib/papic-upload/tiers.ts).
  const finals = await promoteAll(checked.byTier);
  if (!finals) return json({ error: 'record_failed' }, 503);
  const objectTier: CaptureTier = isClip ? playable : photoFirst;
  const r2Ref = finals.get(objectTier)!;
  const posterRef = isClip ? finals.get('poster')! : null;
  const sizeOf = (t: CaptureTier) => checked.byTier.get(t)?.size ?? null;

  // GUEST public-sharing opt-in (Alaala orb gate · RA 10173 explicit consent).
  // Sent true ONLY when the guest ticked the opt-in for THIS shot.
  const sharePublicly = body.share_publicly === true;

  // 🕐 THE SHUTTER — read on ingest, never asked and never surfaced (owner,
  // 2026-09-07). The camera stamps it at the grab and the queue replays it, so
  // a shot that spent six hours waiting for signal is still filed under the
  // minute it was taken rather than the minute it landed.
  const capturedAtIsoValue = capturedAtIso(parseCapturedAtMs(body.captured_at_ms));

  // Optional on-device face descriptors (mode_a only, best-effort). A
  // malformed field just disables auto-tag for this shot.
  let faceVectors: number[][] = [];
  if (Array.isArray(body.face_vectors)) {
    faceVectors = (body.face_vectors as unknown[]).filter(
      (v): v is number[] => Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number'),
    );
  }
  let subjectCenterX: number | null = null;
  let subjectCenterY: number | null = null;
  {
    const c = body.subject_center as { x?: unknown; y?: unknown } | null | undefined;
    const sx = Number(c?.x);
    const sy = Number(c?.y);
    if (c && Number.isFinite(sx) && Number.isFinite(sy) && sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) {
      subjectCenterX = sx;
      subjectCenterY = sy;
    }
  }

  // ── ONE CALL: BOOK THE POINTS AND WRITE THE ROW — OR NEITHER ─────────────
  // (20271276810836.) papic_record_guest_capture_and_spend books the shared
  // pot / the guest's own camera and writes the row inside one transaction: they
  // commit together or neither happens. A repeat of a shutter that already
  // landed books nothing at all.
  //
  // ⚠ NO SIGNATURE-FALLBACK LADDER, deliberately: deploy-prod applies migrations
  // BEFORE it triggers the deploy, and if the function were ever missing the
  // error below answers 500, which the phone's queue retries (keyed by the
  // shutter id, so the retry lands once).
  //
  // ⚠ SERVICE-ROLE ONLY — `admin` is the service-role client.
  const { data, error } = await admin.rpc('papic_record_guest_capture_and_spend', {
    p_guest_id: session.guest_id,
    p_r2_object_key: r2Ref,
    p_consent_to_public: sharePublicly,
    p_media_type: mediaType,
    p_duration_ms: durationMs,
    p_poster_r2_key: posterRef,
    p_points_cost: cost,
    p_captured_at: capturedAtIsoValue,
    p_client_capture_id: clientCaptureId,
  });
  const neededIntents = needed.map((t) => intentFor(intents, t)!);
  if (error) {
    // Nothing was spent: the transaction rolled back with the error.
    console.error('[supabase-error] app/api/papic/guest-capture/route.ts · rpc:papic_record_guest_capture_and_spend', error);
    await discardFinalObjects(neededIntents);
    return json({ error: 'record_failed' }, 500);
  }

  const recordStatus = (data as { status?: string } | null)?.status;
  if (recordStatus === 'camera_points_exhausted') {
    // The authoritative refusal — the pot is short, so the couple is told.
    await discardFinalObjects(neededIntents);
    after(async () => {
      await tellTheCouplePapicPoolIsSpent(session.event_id);
    });
    return json({ status: 'camera_points_exhausted' }, 409);
  }
  const result = (data ?? {}) as {
    status?: string;
    total?: number;
    used?: number;
    remaining?: number;
    // Which limit refused, when `status` is `quota_exhausted`:
    // `guest_spend_ceiling` — the COUPLE's per-guest ceiling (migration
    // 20271184624871); `per_guest_credits` — the platform's own 150. What the
    // guest's SCREEN says is the thing that has to split, and this lets it.
    reason?: string;
    // The couple's ceiling on this guest in credits, or null when none binds.
    ceiling?: number | null;
  };
  if (result.status !== 'ok') {
    await discardFinalObjects(neededIntents);
    return json(result, result.status === 'quota_exhausted' ? 409 : 400);
  }
  // 🔁 A `duplicate` answer is a success that spent nothing.
  const recordDuplicate = (data as { duplicate?: boolean } | null)?.duplicate === true;

  let captureId: string | null =
    typeof (data as { capture_id?: unknown } | null)?.capture_id === 'string'
      ? (data as { capture_id: string }).capture_id
      : null;
  if (!captureId) {
    const { data: capRow } = await admin
      .from('papic_guest_captures')
      .select('capture_id')
      .eq('guest_id', session.guest_id)
      .eq('client_capture_id', clientCaptureId)
      .maybeSingle();
    captureId = (capRow?.capture_id as string | undefined) ?? null;
  }
  const wantFull = await eventKeepsFullRes(admin, session.event_id);
  if (recordDuplicate) return json({ ...result, captureId, wantFull });

  // The first piece's own columns: a photo's thumbnail IS its thumb_r2_key; a
  // clip's poster is its display still (lib/papic-derivatives.ts sets
  // display = poster for clips). Plus the dominant-face center (Tier-2 reframe).
  if (captureId) {
    const patch: Record<string, unknown> = isClip
      ? { display_r2_key: posterRef, display_bytes: sizeOf('poster') }
      : photoFirst === 'thumb'
        ? { thumb_r2_key: r2Ref, thumb_bytes: sizeOf('thumb') }
        : { orig_bytes: sizeOf('original') };
    if (subjectCenterX !== null && subjectCenterY !== null) {
      patch.subject_center_x = subjectCenterX;
      patch.subject_center_y = subjectCenterY;
    }
    const { error: patchErr } = await admin.from('papic_guest_captures').update(patch).eq('capture_id', captureId);
    if (patchErr) console.error('[supabase-error] app/api/papic/guest-capture/route.ts · from:papic_guest_captures.update(first piece)', patchErr);
  }
  await settleCaptureIntents(admin, neededIntents.map((i) => i.r2_ref));
  await dropStagingObjects(neededIntents);

  // Always-on NSFW screen (Apple 1.2 filter · corpus hard constraint) — run
  // BEFORE answering now that this call is off the shutter path (the phone's
  // queue makes it). screenCapture classifies the photo's thumbnail, or a
  // clip's poster (the video bytes are never classified); a classifier error
  // leaves the row 'unscreened' and every shared surface keeps it hidden until
  // the re-screen sweep (lib/papic-nsfw-rescreen-sweep.ts) heals it.
  await screenCapture({ table: 'papic_guest_captures', r2ObjectKey: r2Ref }).catch(() => {});

  after(async () => {
    // FACE auto-tag (best-effort) — match the on-device descriptors against the
    // event's CONSENTED enrollments. The small vectors never leave our server.
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
    if (!captureId) return;
    if (!isClip && photoFirst === 'thumb') return; // the display copy follows (attach)
    // Complete at record: a clip (poster + playable), or a photo that came with
    // its original only. The SERVER derivation — the fallback the phone's own
    // copies replaced — makes the stills, then the wall gate.
    try {
      const { generatePhotoDerivatives, generateClipThumb } = await import('@/lib/papic-derivatives');
      if (isClip) {
        if (posterRef) await generateClipThumb(posterRef, 'papic_guest_captures', 'capture_id', captureId);
      } else {
        await generatePhotoDerivatives(r2Ref, 'papic_guest_captures', 'capture_id', captureId);
      }
    } catch {
      // best-effort — derivatives never break a capture
    }
    await afterVisible(session, captureId);
  });
  if (isClip && (!wantFull || playable === 'clip_raw')) {
    await handOffToDrive(session, r2Ref, 'video/mp4', captureId);
  } else if (!isClip && photoFirst === 'original') {
    await handOffToDrive(session, r2Ref, 'image/jpeg', captureId);
  }

  return json({ ...result, captureId, wantFull });
}

/** FaceBlock bake, then the wall gate (the wall is an allowlist — only 'clean'). */
async function afterVisible(session: GuestSession, captureId: string): Promise<void> {
  try {
    // P2 FaceBlock bake sits between the screen and the wall gate: on a
    // FaceBlock event the ingest withholds un-baked rows. FAILS CLOSED.
    const { bakeFaceBlurForCapture } = await import('@/lib/face-blur');
    await bakeFaceBlurForCapture({ table: 'papic_guest_captures', sourceId: captureId });
    await ingestToWall('papic_guest_captures', captureId);
  } catch {
    // best-effort — the wall reconcile never blocks a capture
  }
  void session;
}

// Auto-sync this guest capture into the couple's Google Drive (Phase 2),
// cron-free: enqueue, then copy in the BACKGROUND. No-op until Drive is
// connected; best-effort; dedup is per drive_copy_artifacts.r2_object_key.
// Handed off ONCE, with the shot's final full copy (display, or the original).
async function handOffToDrive(session: GuestSession, r2Ref: string, mimeType: string, captureId: string | null): Promise<void> {
  try {
    // 🧼 Only a shot the screen PASSED leaves for the couple's Drive.
    if (!captureId) return;
    const { data: row } = await createAdminClient()
      .from('papic_guest_captures')
      .select('moderation_state')
      .eq('capture_id', captureId)
      .maybeSingle();
    if ((row as { moderation_state?: string } | null)?.moderation_state !== 'clean') return;
    await enqueueDriveCopy({
      eventId: session.event_id,
      artifactType: 'papic',
      files: [
        {
          r2ObjectKey: r2Ref,
          fileName: r2Ref.split('/').pop() || 'papic',
          mimeType,
          sourceTable: 'papic_photos',
        },
      ],
    });
    after(() => runDriveCopyBatch({ eventId: session.event_id }).catch(() => {}));
  } catch {
    // best-effort
  }
}

// ── attach ──────────────────────────────────────────────────────────────────
async function handleAttach(
  session: GuestSession,
  admin: Admin,
  body: Body,
  clientCaptureId: string,
  prior: CaptureRow | null,
): Promise<NextResponse> {
  if (!prior) return json({ error: 'not_recorded_yet' }, 409);
  const isClip = prior.media_type === 'clip';
  const asked = Array.isArray(body.tiers) ? (body.tiers as unknown[]).filter(isCaptureTier) : [];
  const allowed: CaptureTier[] = isClip ? ['clip_raw'] : ['tile', 'display', 'original'];
  const tiers = asked.filter((t) => allowed.includes(t));
  if (tiers.length === 0) return json({ error: 'bad_tier' }, 400);
  if (prior.moderation_state === 'nsfw_blocked') return json({ status: 'ok', blocked: true });

  // The record's own screen must have RUN before more of this shot is accepted.
  // A classifier outage at record leaves the row 'unscreened' (hidden from every
  // other person); the phone's retry of this call is what heals it — and until
  // it does, the phone keeps the pieces and says it is still sending.
  if (prior.moderation_state === 'unscreened' && prior.r2_object_key) {
    await screenCapture({ table: 'papic_guest_captures', r2ObjectKey: prior.r2_object_key }).catch(() => {});
    const { data: again } = await admin
      .from('papic_guest_captures')
      .select('moderation_state')
      .eq('capture_id', prior.capture_id)
      .maybeSingle();
    const state = (again as { moderation_state?: string } | null)?.moderation_state;
    if (state === 'unscreened') return json({ error: 'screen_unavailable' }, 503);
    if (state === 'nsfw_blocked') return json({ status: 'ok', blocked: true });
  }

  const intents = await readCaptureIntents(admin, session.guest_id, clientCaptureId);
  if (!intents) return json({ error: 'attach_failed' }, 503);
  const checked = await loadOrRedo(intents, tiers);
  if (!checked.ok) return checked.res;

  // 🧼 SCREEN EVERY STILL BEFORE ITS KEY IS WRITTEN. A row's thumbnail was
  // screened at record; a display copy or an original is a DIFFERENT file and
  // could be a different picture. The bytes screened here are the bytes
  // promoted below — nothing points at a file that has not passed.
  for (const tier of tiers) {
    const loaded = checked.byTier.get(tier)!;
    if (!loaded.bytes) continue; // a clip's raw: video bytes are never classified
    const verdict = await screenTierBytes({
      subjectTable: 'papic_guest_captures',
      ref: loaded.intent.r2_ref,
      eventId: session.event_id,
      bytes: loaded.bytes,
    });
    if (verdict === 'error') return json({ error: 'screen_unavailable' }, 503);
    if (verdict === 'nsfw_blocked') {
      await admin
        .from('papic_guest_captures')
        .update({ moderation_state: 'nsfw_blocked' })
        .eq('capture_id', prior.capture_id)
        .in('moderation_state', ['unscreened', 'clean']);
      await settleCaptureIntents(admin, tiers.map((t) => intentFor(intents, t)!.r2_ref));
      return json({ status: 'ok', blocked: true });
    }
  }
  const finals = await promoteAll(checked.byTier);
  if (!finals) return json({ error: 'attach_failed' }, 503);
  const refOf = (t: CaptureTier) => finals.get(t)!;
  const sizeOf = (t: CaptureTier) => checked.byTier.get(t)?.size ?? null;

  const patch: Record<string, unknown> = {};
  if (tiers.includes('tile')) {
    patch.tile_r2_key = refOf('tile');
    patch.tile_bytes = sizeOf('tile');
  }
  if (tiers.includes('display')) {
    patch.display_r2_key = refOf('display');
    patch.display_bytes = sizeOf('display');
    // The row was born pointing at its thumbnail; the display copy is now the
    // photograph (unless an original already arrived).
    if (!prior.r2_object_key || prior.r2_object_key === prior.thumb_r2_key) {
      patch.r2_object_key = refOf('display');
    }
  }
  if (tiers.includes('original')) {
    patch.r2_object_key = refOf('original');
    patch.orig_bytes = sizeOf('original');
  }
  if (tiers.includes('clip_raw')) {
    // The web copy the row was born with becomes clip_web_r2_key; the raw is
    // the original. Never let the two be the same object (the poster trap).
    const web = prior.r2_object_key;
    const raw = refOf('clip_raw');
    if (!web || !clipWebKeyDistinct(web, { poster_r2_key: prior.poster_r2_key, display_r2_key: prior.display_r2_key, r2_object_key: raw })) {
      return json({ error: 'key_collision' }, 409);
    }
    patch.clip_web_r2_key = web;
    patch.clip_web_bytes = intentFor(intents, 'clip_web')?.size_bytes ?? null;
    patch.r2_object_key = raw;
  }

  const { error: updErr } = await admin
    .from('papic_guest_captures')
    .update(patch)
    .eq('capture_id', prior.capture_id)
    .eq('guest_id', session.guest_id)
    .eq('event_id', session.event_id);
  if (updErr) {
    console.error('[supabase-error] app/api/papic/guest-capture/route.ts · from:papic_guest_captures.update(attach)', updErr);
    return json({ error: 'persist_failed' }, 500);
  }
  await settleCaptureIntents(admin, tiers.map((t) => intentFor(intents, t)!.r2_ref));
  await dropStagingObjects(tiers.map((t) => intentFor(intents, t)!));

  const wantFull = await eventKeepsFullRes(admin, session.event_id);
  if (tiers.includes('display')) {
    const captureId = prior.capture_id;
    const displayRef = refOf('display');
    after(async () => {
      // Server derivation stays the FALLBACK: a phone that sent no tile gets one
      // made from the display copy.
      if (!tiers.includes('tile') && !prior.tile_r2_key) {
        try {
          const { generateTileDerivative } = await import('@/lib/papic-derivatives');
          await generateTileDerivative(displayRef, 'papic_guest_captures', 'capture_id', captureId);
        } catch {
          // best-effort
        }
      }
      await afterVisible(session, captureId);
    });
    if (!wantFull) await handOffToDrive(session, displayRef, 'image/webp', captureId);
  }
  if (tiers.includes('original')) await handOffToDrive(session, refOf('original'), 'image/jpeg', prior.capture_id);
  if (tiers.includes('clip_raw')) await handOffToDrive(session, refOf('clip_raw'), 'video/mp4', prior.capture_id);

  return json({ status: 'ok' });
}

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  // 🚫 JSON ONLY. A multipart body is the old byte path, which Vercel cuts at
  // 4.5 MB before this line runs; refusing it here keeps it from coming back.
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return json({ error: 'bytes_not_accepted' }, 415);
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) {
    return json({ error: 'bad_request' }, 413);
  }
  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_JSON_BYTES) return json({ error: 'bad_request' }, 413);
    body = JSON.parse(raw) as Body;
    if (!body || typeof body !== 'object') throw new Error('shape');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const clientCaptureId = readClientCaptureId(body[CLIENT_CAPTURE_ID_FIELD]);
  if (!clientCaptureId) return json({ error: 'bad_request' }, 400);
  const mediaType = body.media_type === 'clip' ? 'clip' : 'photo';
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: priorRow, error: priorErr } = await admin
    .from('papic_guest_captures')
    .select('capture_id, media_type, r2_object_key, poster_r2_key, display_r2_key, tile_r2_key, thumb_r2_key, clip_web_r2_key, moderation_state')
    .eq('guest_id', session.guest_id)
    .eq('client_capture_id', clientCaptureId)
    .maybeSingle();
  if (priorErr) {
    console.error('[supabase-error] app/api/papic/guest-capture/route.ts · from:papic_guest_captures.select(client_capture_id)', priorErr);
    return json({ error: 'record_failed' }, 503);
  }
  const prior = (priorRow as CaptureRow | null) ?? null;

  switch (body.op) {
    case 'sign':
      return handleSign(session, admin, body, clientCaptureId, mediaType, prior);
    case 'record':
      return handleRecord(session, admin, body, clientCaptureId, mediaType, prior);
    case 'attach':
      return handleAttach(session, admin, body, clientCaptureId, prior);
    default:
      return json({ error: 'bad_request' }, 400);
  }
}
