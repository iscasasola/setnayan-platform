import { randomUUID } from 'node:crypto';
import {
  tenancyForPathPrefix,
  UPLOAD_TENANCY_REFUSAL,
} from '@/lib/upload-prefix-tenancy';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventOwnsPapicSeats } from '@/lib/papic-seats';
import { rateLimit } from '@/lib/rate-limit';
import { R2_BUCKETS, isR2Configured, type R2BucketKey } from '@/lib/r2';
import { pathPrefixIsAcceptable, privateBucketRootIsAllowed } from '@/lib/r2-client-ref';
import {
  encodeR2Ref,
  presignDisplayUrl,
  presignUploadUrl,
} from '@/lib/uploads';
import {
  papicPerCameraTier,
  papicRungForTier,
  isPaidCameraTier,
  papicCameraOrderPaid,
  papicCaptureCost,
  PAPIC_CLIP_COST_MIN,
  resolvePointsGate,
  type PointsGateVerdict,
  eventUnliFreeViaUnlock,
  eventLtdFreeViaUnlock,
} from '@/lib/papic-cameras';
import { papicManualUploadsClosed } from '@/lib/papic-uploads-open';
import { combinePointsGates } from '@/lib/papic-event-pool';
import { eventHasPapicUnlock } from '@/lib/entitlements';
import { captureWindowState } from '@/lib/papic-window';

/**
 * Presigned-URL endpoint used by `<FileUpload>` to upload files directly to
 * Cloudflare R2 without round-tripping the bytes through Next.js.
 *
 * Flow:
 *   1. Client POSTs `{ bucket, pathPrefix, filename, contentType, sizeBytes }`.
 *   2. We auth via the Supabase session cookie. Anonymous callers get 401.
 *   3. We whitelist the bucket key, sanitize the filename, validate the size,
 *      validate the MIME type, and pin the object key to a UUID so two users
 *      uploading the same filename can't collide.
 *   4. We hand back:
 *        • `uploadUrl`  — presigned PUT URL (5-minute TTL)
 *        • `r2Key`      — the object key we picked
 *        • `r2Ref`      — the `r2://bucket/key` value to persist via the
 *                         parent form (see `lib/uploads.ts` for the format)
 *        • `displayUrl` — presigned GET URL (24h TTL) for the preview after
 *                         a successful PUT
 *
 * The client is expected to PUT the file body with `Content-Type` matching
 * the value it sent in step 1 — the signature binds that header.
 *
 * Errors are surfaced as plain JSON `{ error: string }`. Anything unexpected
 * gets `Sentry.captureException` so we see uploads breaking before users do.
 */

type RequestBody = {
  bucket?: string;
  pathPrefix?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  /**
   * Papic seat capture path. When present, the bucket + object prefix are
   * derived SERVER-SIDE from the seat this token resolves to (and the caller
   * must be its claimer) — the client never chooses `bucket`/`pathPrefix` for a
   * seat upload. Closes the open "any signed-in user presigns into media root
   * with a free-form prefix" hole that login-free (anonymous) claim widens.
   */
  papicSeatToken?: string;
};

// Papic seat captures are images (photo / clip poster) + short clips only. A
// 10-second 1440p clip at the client's bounded ~10 Mbps encode is ~12.5 MB
// (10 Mbps × 10 s ÷ 8) — so the seat path uses TIGHT per-object ceilings (well
// below the generic 10 MB image / 200 MB video caps) as the real backstop
// against a leaked-link storage-abuse / long-clip attempt.
const PAPIC_SEAT_IMAGE_MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const PAPIC_SEAT_VIDEO_MAX_BYTES = 48 * 1024 * 1024; // 48 MB — ~3.8× a ~12.5 MB 10s/1440p clip; headroom for VBR overshoot + audio (was 40 MB, sized for a 5s clip)

const BUCKET_KEYS: ReadonlySet<R2BucketKey> = new Set([
  'media',
  'threadFiles',
  'vendorContracts',
  'samples',
  'vendorVerification',
]);

// Aliases the client sends ("thread-files") map to the internal R2BucketKey
// ("threadFiles"). Keeps the API ergonomic for callers while preserving the
// camelCase typed-object in lib/r2.ts.
const BUCKET_ALIASES: Record<string, R2BucketKey> = {
  media: 'media',
  'thread-files': 'threadFiles',
  threadFiles: 'threadFiles',
  'vendor-contracts': 'vendorContracts',
  vendorContracts: 'vendorContracts',
  samples: 'samples',
  'vendor-verification': 'vendorVerification',
  vendorVerification: 'vendorVerification',
};

// Per-bucket hard caps. The component-level cap is an additional sanity
// check; this one stops a hostile client from claiming `sizeBytes: 5` and
// then PUTting 100 MB because `Content-Length` IS signed (presignUploadUrl
// adds `content-length` to the signed headers set).
const BUCKET_MAX_BYTES: Record<R2BucketKey, number> = {
  media: 10 * 1024 * 1024, // 10 MB — covers logos (small) and portfolio photos
  threadFiles: 20 * 1024 * 1024, // 20 MB — force-majeure evidence + PDF receipts
  vendorContracts: 25 * 1024 * 1024, // 25 MB — signed PDF contracts
  samples: 10 * 1024 * 1024,
  vendorVerification: 15 * 1024 * 1024, // 15 MB — DTI, BIR 2303, Mayor's Permit, etc.
};

// MIME type whitelist — same union the existing `lib/storage.ts` accepts,
// plus PDF for force-majeure evidence and signed contracts, plus a small set
// of audio types for the AI Catalog Generator's voice-input flow (Filipino/
// Taglish service descriptions transcribed by OpenAI Whisper). Audio uploads
// go to the thread-files bucket under `vendors/{id}/voice-input/`.
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'application/pdf',
  // Wedding-website chrome (Increment B · Wedding_Website_Lifecycle_Spec §6.2):
  // a looping background song + a short hero video the couple uploads to the
  // media bucket. Size-bounded by TYPE_MAX_BYTES below (NOT the 10 MB image
  // cap) so a full-length song / a compressed clip fits while image uploads
  // stay tight. Additive — existing image/PDF flows are unchanged.
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

// Per-MIME-prefix size overrides that take precedence over the per-bucket cap.
// Keeps the image cap tight (10 MB on `media`) while allowing the larger
// audio/video chrome uploads. Bytes. The signed content-length still binds the
// actual PUT, so a client can't claim a small size then send more.
const TYPE_MAX_BYTES: ReadonlyArray<readonly [string, number]> = [
  ['video/', 200 * 1024 * 1024], // 200 MB ceiling — a Save-the-Date clip / hero loop. The
  // STD media picker auto-compresses larger videos client-side to a web-friendly
  // target before upload; this is the hard safety net (R2 egress is free). 2026-06-19
  ['audio/', 40 * 1024 * 1024], // 40 MB — a full-length background song (covers a ~30-min onboarding track)
];

// Maximum filename length we'll preserve in the object key. Anything longer
// is truncated. (Object keys themselves can be much longer, but the
// `original-${name}` convention falls apart at some point.)
const MAX_FILENAME_LEN = 120;

// Pathprefix sanity bound. Above this is almost certainly a client bug or
// attempt to balloon storage costs by chaining unbounded segments.
const MAX_PATH_PREFIX_LEN = 256;

// MediaRecorder appends `;codecs=…`; strip parameters to get the base MIME.
// Used by the per-camera quota probe (it must decide photo-vs-clip before the
// main content-type validation block runs further down).
function baseContentTypeOf(raw: string | undefined): string {
  return (typeof raw === 'string' ? raw : '').split(';')[0]?.trim() ?? '';
}

function sanitizeFilename(raw: string): string {
  // Strip any path components — only the basename matters in the object key.
  const base = raw.split(/[\\/]/).pop() ?? raw;
  // Lowercase the extension for consistent grouping; preserve the basename
  // case so the original filename remains recognizable on download.
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const safeStem = stem.length > 0 ? stem : 'file';
  const composed = ext ? `${safeStem}.${ext}` : safeStem;
  return composed.slice(0, MAX_FILENAME_LEN);
}

function sanitizePathPrefix(raw: string): string {
  // Trim leading/trailing slashes, collapse repeats, drop `..` segments —
  // standard defenses against an absolute or escape-y pathPrefix.
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  const segments = trimmed
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '..' && s !== '.');
  return segments.join('/');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // R2 is required for the presigned-PUT flow — there's no Supabase
  // Storage equivalent of "browser PUTs the bytes directly to the bucket".
  // The server-side helper `uploadPublicAsset` in `lib/storage.ts` DOES
  // fall back to Supabase Storage; surface that to the operator so they
  // know which path needs the env vars.
  if (!isR2Configured()) {
    console.warn(
      '[upload] Rejecting presign request — R2 env vars unset. ' +
        'Browser-direct uploads via /api/upload require R2. ' +
        'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in Vercel.',
    );
    return NextResponse.json(
      {
        error:
          'Uploads are not configured. Please contact support — the operator needs to set R2 credentials.',
      },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to upload.' },
      { status: 401 },
    );
  }

  // Best-effort flood backstop (see lib/rate-limit — in-memory, per-instance,
  // NOT a hard cross-instance guarantee). Keyed on the caller; a generous
  // ceiling no legitimate capture/upload session approaches. The real
  // protection for the seat path is the server-derived prefix + tight byte caps
  // below; this just blunts a naive presign flood from one identity.
  const rl = rateLimit(`upload:${user.id}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many uploads — give it a moment and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  // ---- Resolve target bucket + object prefix ------------------------------
  // Two modes:
  //   • PAPIC SEAT — bucket + prefix derived SERVER-SIDE from the seat this
  //     token resolves to (caller must be its claimer + the seat live). The
  //     client never picks the prefix, so a leaked link can only ever write
  //     into its own seat's space, bounded by reissue.
  //   • GENERIC — the existing client-chosen bucket + pathPrefix (dashboard
  //     uploads by event members / vendors).
  let bucketKey: R2BucketKey;
  let pathPrefix: string;
  let seatMode = false;

  const papicSeatToken =
    typeof body.papicSeatToken === 'string' ? body.papicSeatToken.trim() : '';

  if (papicSeatToken) {
    // RLS (paparazzi_seats_claimer_read) returns the row only for the claimer —
    // resolving by token doubles as the auth check; we re-assert it explicitly.
    const { data: seat } = await supabase
      .from('paparazzi_seats')
      .select(
        'seat_id, event_id, revoked_at, claimer_user_id, tier, sku_code, paid_order_id, valid_from, valid_until, seat_index',
      )
      .eq('claim_qr_token', papicSeatToken)
      .maybeSingle();
    if (!seat || seat.claimer_user_id !== user.id || seat.revoked_at) {
      return NextResponse.json(
        { error: 'This seat isn’t yours to upload to.' },
        { status: 403 },
      );
    }

    // "MAY PHOTOS BE ADDED BY HAND?" — the couple's switch, read on the SERVER.
    // The record layer is the door (recordSeatCapture asks the same helper); this
    // is the orphan-byte leak guard, exactly like the window and payment probes
    // below: no URL ⇒ no bytes uploaded for a capture that is going to be
    // refused. Only the Uploads camera is affected — every other seat is a real
    // camera and the switch has no opinion about it.
    // ⚠ THE `code` IS LOAD-BEARING. Without it the picker turns a code-less 403
    // into a generic failure and tells somebody their connection is at fault.
    {
      let uploadsClosed = false;
      try {
        uploadsClosed = await papicManualUploadsClosed(
          createAdminClient(),
          seat.event_id as string,
          (seat as { seat_index?: number | null }).seat_index ?? null,
        );
      } catch {
        uploadsClosed = false;
      }
      if (uploadsClosed) {
        return NextResponse.json(
          {
            error: 'Adding photos by hand is switched off for this celebration.',
            code: 'uploads_closed',
          },
          { status: 403 },
        );
      }
    }
    // Per-camera seats (sku_code PAPIC_CAMERA_*) carry their own paid-gate +
    // daily quota (below) and are NOT the legacy PAPIC_SEATS pack — so they skip
    // the pack-ownership re-check. null for legacy pack seats.
    const cameraTier = papicPerCameraTier(
      (seat as { sku_code?: string | null }).sku_code ?? null,
      (seat as { tier?: string | null }).tier ?? null,
    );
    // Legacy PAPIC_SEATS pack: entitlement re-check on the ADMIN client (the
    // claimer can't read orders under RLS). Fail-OPEN on a config/transient error
    // so a paying couple's crew is never blocked by an entitlement-read hiccup.
    if (!cameraTier) {
      let owned = true;
      try {
        const admin = createAdminClient();
        owned = await eventOwnsPapicSeats(admin, seat.event_id as string);
      } catch {
        owned = true;
      }
      if (!owned) {
        return NextResponse.json(
          { error: 'This Papic pack is no longer active.' },
          { status: 403 },
        );
      }
    }

    // PER-CAMERA presign gate (per-camera model · PR3): for a per-camera seat,
    // refuse the URL when its order isn't paid yet or its daily capture-points
    // budget is spent — no URL ⇒ no orphan bytes. The record-layer points
    // reserve RPC is the authoritative backstop.
    if (cameraTier) {
      // Capture WINDOW gate (owner 2026-06-26): refuse the URL outside the
      // event's chosen window (no URL ⇒ no orphan bytes). Mirrors the
      // record-layer gate in app/papic/actions.ts. Fail-OPEN on null bounds
      // (legacy seats) so a pre-window camera is never broken.
      {
        // ⚠ USE THE SHARED HELPER. This used to Date.parse() the DATE columns
        // directly, which reads "2026-09-19" as midnight UTC = 08:00 Manila —
        // collapsing a one-day window to a single instant. See
        // captureWindowState() for the full story.
        const vf = (seat as { valid_from?: string | null }).valid_from;
        const vu = (seat as { valid_until?: string | null }).valid_until;
        const windowState = captureWindowState(vf, vu);
        if (windowState !== 'open') {
          // ⚠ THE `code` IS LOAD-BEARING, not decoration. Without it the client
          // cannot tell a refusal from a network failure: papic-seat-capture
          // turns a code-less 403 into a generic Error('presign'), which is not
          // in PAPIC_TERMINAL_ERRORS, so the shot goes to the durable OFFLINE
          // QUEUE and the counter still increments. The photographer is told
          // nothing and believes the photo was taken.
          return NextResponse.json(
            {
              error:
                windowState === 'not_started'
                  ? 'This camera’s capture window hasn’t opened yet.'
                  : 'This camera’s capture window has closed.',
              code: windowState === 'not_started' ? 'capture_not_started' : 'capture_window_closed',
            },
            { status: 403 },
          );
        }
      }
      const admin = createAdminClient();
      // Papic Unlock ("Unlock all of Papic" pass · PR9 #2269 grants the FEATURES;
      // this is the deferred ALLOWANCE half): every camera shoots UNLIMITED with
      // NO per-camera payment — skip both the presign paid-gate and the daily
      // quota probe. Fail toward the normal metered gate on a read error.
      const unlocked = await eventHasPapicUnlock(
        admin,
        seat.event_id as string,
      ).catch(() => false);
      // Every PAID rung (mini · legacy roll · ltd · unlimited) is gated; only the
      // free tier skips. Expressed as "not free" so a new rung can never slip
      // through the paid-gate by being missing from an allow-list.
      if (!unlocked && isPaidCameraTier(cameraTier)) {
        let paid = false;
        try {
          paid = await papicCameraOrderPaid(
            admin,
            (seat as { paid_order_id?: string | null }).paid_order_id ?? null,
          );
          // Unlock umbrellas (money-gated · TRUE only on an ACTIVE order, so a
          // non-owner's presign is never freed): PAPIC_UNLOCK (₱15,000) frees
          // Unli; PAPIC_UNLOCK_LTD (₱9,000, owner 2026-07-11) frees the ₱30
          // rung it was sold against — legacy 'roll', today's Mini. The new ₱50
          // Ltd rung is covered by NO pass (owner pricing call) and stays gated.
          const rung = papicRungForTier(cameraTier);
          if (!paid && rung === 'unlimited') {
            paid = await eventUnliFreeViaUnlock(admin, seat.event_id as string);
          }
          if (!paid && rung === 'mini') {
            paid = await eventLtdFreeViaUnlock(admin, seat.event_id as string);
          }
        } catch {
          paid = false;
        }
        if (!paid) {
          return NextResponse.json(
            {
              error: 'This camera activates once your payment is confirmed.',
              code: 'awaiting_payment',
            },
            { status: 402 },
          );
        }
      }
      // Capture-POINTS presign gate (Papic v3 · brief PR-3): 1 photo = 1 pt ·
      // 1 clip = 7 pts, budget resolved by the RPC from papic_tier_config
      // (free/mini/roll 20 · ltd 70 · unlimited ∞ — admin-editable, never
      // hardcoded here). At 0 remaining we refuse the URL — no URL ⇒ no orphan
      // R2 bytes; the record-layer reserve (papic/actions) is the authoritative
      // backstop. Fail-CLOSED on any RPC failure EXCEPT function-not-found
      // (resolvePointsGate — the seam-cutover carve-out), so a metering outage
      // can never silently un-meter a camera.
      {
        const cameraKind = baseContentTypeOf(body.contentType).startsWith(
          'video/',
        )
          ? 'clip'
          : 'photo';
        // ⚠ THE CHEAPEST CLIP, NOT THE DEAREST — and this is a real decision,
        // not a rounding choice. No file exists at presign time, so the length
        // is unknowable here; billing it at the top band would mean a shooter
        // with 3 credits left is refused a URL for a two-second clip that
        // costs 2 and that they can plainly afford. Refusing a shot somebody
        // CAN pay for is a user-facing defect; the cost of gating at the floor
        // is a rare orphan object when someone with 2-7 credits shoots long,
        // and the authoritative reserve (app/papic/actions) still refuses it.
        //
        // This seam's stated job has always been "no URL ⇒ no orphan R2 bytes",
        // never "decide the price". It now refuses only when the camera cannot
        // afford ANY clip at all.
        const cost =
          cameraKind === 'clip'
            ? PAPIC_CLIP_COST_MIN
            : papicCaptureCost(cameraKind);
        let seatGate: PointsGateVerdict = 'allow';
        if (!unlocked) {
          try {
            // ⚠ BOTH BALANCES, not the camera's own bucket alone. Asking only
            // the bucket is what refused an upload URL to a camera that had
            // spent its dedicated credits while the shared pot behind it was
            // full — the ceiling-not-floor defect, showing up one seam earlier
            // than the reserve did (owner 2026-08-11).
            const { data: remaining, error: remErr } = await admin.rpc(
              'papic_capture_points_available',
              { p_seat_id: seat.seat_id as string, p_event_id: seat.event_id as string },
            );
            seatGate = resolvePointsGate(
              remErr ? (remErr.code ?? 'unknown') : null,
              typeof remaining === 'number' ? remaining >= cost : null,
            );
          } catch {
            seatGate = 'blocked'; // thrown ≠ identifiable fn-not-found → fail-CLOSED
          }
        }
        // EVENT-SCOPED capture fence (Phase 0c · lib/papic-event-pool.ts): the
        // flat per-event PASS (PAPIC_UNLOCK / PAPIC_UNLOCK_LTD / the ₱1,499 flat
        // pass) previously bypassed metering entirely — this is the missing
        // bound. The RPC returns MAXINT for every NON-pass event, so this probe
        // is a pure no-op there and today's behaviour is byte-identical. Pool =
        // clamp(guests × 150, 5,000, 30,000) pts, admin-tunable in
        // papic_event_pool_config. Same fail-CLOSED posture as the seat gate.
        //
        // ..._FOR_SEAT (owner-locked 2026-07-29): a PAPIC ONE camera holds its
        // OWN unshared balance, which the seat probe above already read, so the
        // shared pool must not bound it — the RPC returns MAXINT for a dedicated
        // seat. Without this, a One camera would be refused a presigned URL the
        // moment the event's free 50-pt pool ran dry, despite having its own
        // shots left, and the two budgets would be co-enforced instead of
        // separate.
        let eventGate: PointsGateVerdict;
        try {
          const { data: poolLeft, error: poolErr } = await admin.rpc(
            'papic_event_points_remaining_for_seat',
            {
              p_event_id: seat.event_id as string,
              p_seat_id: seat.seat_id as string,
            },
          );
          eventGate = resolvePointsGate(
            poolErr ? (poolErr.code ?? 'unknown') : null,
            typeof poolLeft === 'number' ? poolLeft >= cost : null,
          );
        } catch {
          eventGate = 'blocked';
        }
        // The TIGHTER of the two budgets wins.
        const gate = combinePointsGates(seatGate, eventGate);
        if (gate === 'exhausted') {
          // Same 409 + camera_points_exhausted semantics either way (the client
          // treats it as a terminal cap, no retry, no orphan bytes) — only the
          // copy differs, because the event pool does NOT refill tomorrow.
          return NextResponse.json(
            {
              error:
                seatGate === 'exhausted'
                  ? 'This camera has used today’s shots — it refills tomorrow.'
                  : 'This event has used all its Papic shots.',
              code: 'camera_points_exhausted',
            },
            { status: 409 },
          );
        }
        if (gate === 'blocked') {
          return NextResponse.json(
            {
              error:
                'We couldn’t check this camera’s remaining shots — try again in a moment.',
              code: 'camera_points_unavailable',
            },
            { status: 503 },
          );
        }
      }
    }

    bucketKey = 'media';
    // Seat captures are permanent — written under the `papic/` prefix.
    // event-/seat-scoped, server-derived (sanitized — UUIDs only, but defensive).
    pathPrefix = sanitizePathPrefix(
      `papic/event-${seat.event_id}/seat-${seat.seat_id}`,
    );
    seatMode = true;
  } else {
    // ---- Generic path (existing client-chosen bucket + prefix) ----
    const bucketRaw = typeof body.bucket === 'string' ? body.bucket : '';
    const resolvedBucket = BUCKET_ALIASES[bucketRaw];
    if (!resolvedBucket || !BUCKET_KEYS.has(resolvedBucket)) {
      return NextResponse.json(
        {
          error: `Unknown bucket "${bucketRaw}". Use one of: media, thread-files, vendor-contracts, samples.`,
        },
        { status: 400 },
      );
    }
    bucketKey = resolvedBucket;

    const pathPrefixRaw =
      typeof body.pathPrefix === 'string' ? body.pathPrefix : '';
    if (pathPrefixRaw.length === 0 || pathPrefixRaw.length > MAX_PATH_PREFIX_LEN) {
      return NextResponse.json(
        { error: 'pathPrefix is required and must be 1–256 chars.' },
        { status: 400 },
      );
    }
    const sanitized = sanitizePathPrefix(pathPrefixRaw);
    if (sanitized.length === 0) {
      return NextResponse.json(
        { error: 'pathPrefix must contain at least one non-empty segment.' },
        { status: 400 },
      );
    }
    pathPrefix = sanitized;
  }
  // SEC-6 — two structural refusals on the final prefix, for EVERY branch.
  //
  //  • A RESERVED segment (`std-screened`) holds the sealed copies the public
  //    guest page serves. Those objects carry an `approved` NSFW verdict and are
  //    supposed to be un-writable; a client that could presign a PUT there would
  //    overwrite screened bytes at an already-approved key, which is the whole
  //    bypass wearing a different hat. This route is the only client-driven
  //    presigner for the media bucket, so refusing here is what makes
  //    "immutable" true rather than aspirational (lib/std-video-gate.ts).
  //
  //  • A `:` in any segment makes the KEY URL-SHAPED. `sanitizePathPrefix` drops
  //    `.`/`..` and collapses slashes but happily keeps a scheme segment, so
  //    `pathPrefix: "http://evil.example/v"` minted a real R2 object at
  //    `http:/evil.example/v/<uuid>-clip.mp4` — a string the verify side read as
  //    an object key and the browser resolved to a foreign origin. The read path
  //    no longer accepts such a ref; this stops the decoy being mintable at all.
  //
  // Deliberately non-specific message (lib/r2-client-ref.ts house style): the
  // caller learns their prefix was refused, not which rule caught them.
  if (!pathPrefixIsAcceptable(pathPrefix)) {
    return NextResponse.json(
      { error: 'That upload location isn’t allowed.' },
      { status: 400 },
    );
  }

  // SEC-1 lane #1 — YOU MAY NOT NAME AN ID YOU DO NOT HOLD.
  //
  // The generic branch above lets the client choose the prefix. The bucket is
  // whitelisted, the prefix sanitised, and the final key carries a server-side
  // randomUUID() — so this was never disclosure and never overwrite. It WAS
  // cross-tenant write pollution: any signed-in user could presign a PUT under
  // `deposit-proof/<another-couple's-event>` or `chat/<someone-else's-thread>`,
  // landing bytes in a space the victim's own surfaces read from.
  //
  // The check is shape-based (a UUID segment), not a prefix allowlist, because
  // `<FileUpload>` takes pathPrefix as a PROP — the caller set is open-ended, and
  // an allowlist built by grep would be a guess whose failure mode is a broken
  // upload on a surface nobody tested. A new `receipts/<eventId>` surface is
  // covered the day it ships, with no registry to update.
  //
  // RLS IS THE TENANCY CHECK, not a second bespoke rule: the read below runs on
  // the CALLER's client, so it returns a row only if they may already read that
  // event / thread. Same pattern lib/r2-client-ref.ts documents. Seat mode is
  // exempt — its prefix is derived server-side from the seat, so there is no
  // client-named id to verify.
  if (!seatMode) {
    const tenancy = tenancyForPathPrefix(pathPrefix);
    // ── `profile-photo/<authUserId>` is answered WITHOUT a query ─────────────
    // The prefix names a person, and we already know who is calling, so the
    // tenancy question is just "is that you?". Deliberately not a read against
    // `users`: a row there is created by a trigger, and a check that depends on
    // that row existing would refuse the very first upload of a brand-new
    // account — trading one silent refusal for a rarer, harder one. Comparing
    // ids is stricter, needs no RLS, and cannot be wrong.
    if (tenancy?.kind === 'user') {
      if (tenancy.id !== user.id) {
        return NextResponse.json({ error: UPLOAD_TENANCY_REFUSAL }, { status: 403 });
      }
    } else if (tenancy) {
      // Each kind is checked against ITS OWN table, through the caller's own
      // client so RLS decides. An order id checked against `events` can only
      // ever come back empty — that is the live break this branch fixes, and
      // it is why the third arm exists rather than a widened default.
      const { data: owned } =
        tenancy.kind === 'event'
          ? await supabase
              .from('events')
              .select('event_id')
              .eq('event_id', tenancy.id)
              .maybeSingle()
          : tenancy.kind === 'order'
            ? await supabase
                .from('orders')
                .select('order_id')
                .eq('order_id', tenancy.id)
                .maybeSingle()
            : tenancy.kind === 'vendor'
              ? // A vendor's own shop. Same principle as the other three: the
                // read runs on the CALLER's client, so RLS is the tenancy check
                // — a vendor reaches their own row, an admin reaches any, and a
                // stranger naming someone else's shop id gets nothing back and
                // the same non-specific refusal. Without this arm the id was
                // checked against `events`, which it can never match, so every
                // vendor upload — logo, portfolio, payment QR, booth poster and
                // the verification documents themselves — was refused 403.
                await supabase
                  .from('vendor_profiles')
                  .select('vendor_profile_id')
                  .eq('vendor_profile_id', tenancy.id)
                  .maybeSingle()
              : tenancy.kind === 'community'
                ? // A samahan the caller belongs to — RLS on `communities`
                  // admits members only, so a stranger naming someone else's
                  // group id gets nothing back and the same refusal.
                  await supabase
                    .from('communities')
                    .select('community_id')
                    .eq('community_id', tenancy.id)
                    .maybeSingle()
                : await supabase
                    .from('chat_threads')
                    .select('thread_id')
                    .eq('thread_id', tenancy.id)
                    .maybeSingle();
      if (!owned) {
        // Non-specific on purpose (r2-client-ref house style): a caller must not
        // be able to use this endpoint to learn whether an id exists.
        return NextResponse.json({ error: UPLOAD_TENANCY_REFUSAL }, { status: 403 });
      }
    }
  }
  const bucketName = R2_BUCKETS[bucketKey];

  // SEC-1 lane #1 — a PRIVATE bucket may only be written under a root segment
  // that belongs to it. Keys are minted server-side so nothing is overwritable;
  // what this stops is write POLLUTION across flows — arbitrary bytes landing in
  // `vendors/…/verification/` (which an admin reviews to approve a business) or in
  // `thread-files` (dispute evidence) from an unrelated surface. Public media is
  // deliberately untouched: see the note on PRIVATE_BUCKET_ROOTS for why a
  // fail-closed allowlist over its long prefix tail would be the riskier change.
  //
  // Containment, not tenancy: this proves the prefix family fits the bucket, not
  // that the caller owns the id inside it. Same deliberately non-specific refusal.
  if (!privateBucketRootIsAllowed(bucketName, pathPrefix)) {
    return NextResponse.json(
      { error: 'That upload location isn’t allowed.' },
      { status: 400 },
    );
  }

  const filenameRaw = typeof body.filename === 'string' ? body.filename : '';
  if (filenameRaw.length === 0) {
    return NextResponse.json(
      { error: 'filename is required.' },
      { status: 400 },
    );
  }
  const filename = sanitizeFilename(filenameRaw);

  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  // MediaRecorder sometimes appends `;codecs=opus` (or similar) to the MIME
  // — strip parameters before checking the whitelist so `audio/webm;codecs=opus`
  // matches `audio/webm`. We preserve the original value for the presign so
  // R2 stores the full content-type header the browser sent.
  const baseContentType = contentType.split(';')[0]?.trim() ?? '';
  if (!ALLOWED_MIME_TYPES.has(baseContentType)) {
    return NextResponse.json(
      { error: `Unsupported file type "${contentType || 'unknown'}".` },
      { status: 400 },
    );
  }
  // The seat path only ever uploads JPEG photos/posters + short clips — never
  // PDF/audio. Constrain it so a seat token can't be used to stash other types.
  if (
    seatMode &&
    !baseContentType.startsWith('image/') &&
    !baseContentType.startsWith('video/')
  ) {
    return NextResponse.json(
      { error: 'Papic captures must be a photo or a clip.' },
      { status: 400 },
    );
  }

  const sizeBytes = typeof body.sizeBytes === 'number' ? body.sizeBytes : NaN;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: 'sizeBytes must be a positive integer.' },
      { status: 400 },
    );
  }
  // Per-type override (audio/video chrome) takes precedence over the bucket
  // cap; otherwise the bucket's own cap applies. The Papic seat path uses its
  // OWN tight ceilings (a 10s clip is small) regardless of the generic overrides.
  let maxBytes: number;
  if (seatMode) {
    maxBytes = baseContentType.startsWith('video/')
      ? PAPIC_SEAT_VIDEO_MAX_BYTES
      : PAPIC_SEAT_IMAGE_MAX_BYTES;
  } else {
    const typeOverride = TYPE_MAX_BYTES.find(([prefix]) =>
      baseContentType.startsWith(prefix),
    )?.[1];
    maxBytes = typeOverride ?? BUCKET_MAX_BYTES[bucketKey];
  }
  if (sizeBytes > maxBytes) {
    return NextResponse.json(
      {
        error: `File is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — max for this bucket is ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      },
      { status: 413 },
    );
  }

  // ---- Build object key + presign ----------------------------------------

  // The UUID prefix guarantees uniqueness even when two users upload a file
  // with the same original name. We keep the original (sanitized) filename in
  // the suffix so downloads land with a recognizable name.
  const objectKey = `${pathPrefix}/${randomUUID()}-${filename}`;

  try {
    const [uploadUrl, displayUrl] = await Promise.all([
      presignUploadUrl({
        bucket: bucketName,
        key: objectKey,
        contentType,
        sizeBytes,
      }),
      presignDisplayUrl(bucketName, objectKey),
    ]);

    return NextResponse.json(
      {
        uploadUrl,
        r2Key: objectKey,
        r2Bucket: bucketName,
        r2Ref: encodeR2Ref(bucketName, objectKey),
        displayUrl,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown presign error';
    // Server-side log + Sentry. Sentry init is no-op when SENTRY_DSN is
    // unset, so this is safe in dev.
    console.error('[upload] presign failed', {
      bucket: bucketName,
      key: objectKey,
      error: message,
    });
    Sentry.captureException(err, {
      tags: { route: 'api/upload', bucket: bucketName },
      extra: { objectKey, contentType, sizeBytes, userId: user.id },
    });
    return NextResponse.json(
      { error: 'Could not generate upload URL. Please try again.' },
      { status: 500 },
    );
  }
}
