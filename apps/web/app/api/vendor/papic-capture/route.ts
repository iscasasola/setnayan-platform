import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { classifyImageBytes, decideNsfw } from '@/lib/nsfw-screen';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import {
  deriveVendorPapicTier,
  fetchVendorPapicPointsSpent,
  fetchVendorPapicCreditsGranted,
} from '@/lib/vendor-papic-grants';
import { canCapture, pointsForMedia } from '@/lib/vendor-papic-tier';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';

// POST /api/vendor/papic-capture
//
// The vendor ON-THE-DAY Papic capture lane (owner-locked 2026-07-18). A signed-in
// vendor working a booked event shoots photos (and, on Ltd/Unli, ≤10s clips) into
// their OWN capture lane (public.vendor_papic_captures). Whole capture is done
// server-side (mirrors the guest route): validate → enforce the tier's
// capture-point budget → PUT to R2 with the service-role client → insert the row
// under the vendor's RLS client (the insert policy is the hard booked/own-profile
// gate) → NSFW-screen in the background.
//
// ⚠️ THIS SURFACE IS LIVE. It is gated by isVendorPapicCaptureEnabled() (the
// admin Data Privacy control `vendor_papic_capture`), and that control has been
// **ACTIVE IN PRODUCTION SINCE 2026-07-16 04:51 UTC**, approved by the owner.
// This comment used to say "default OFF … this route 403s", and six weeks of
// planning read it and believed the lane was shut. A privacy control's state
// lives in the DATABASE; a comment describing it is a claim with an expiry date.
// Geo is never stored; the 10s clip cap is a product lock; NSFW is always-on.
//
// ⏱ AND THE LANE NOW CLOSES WITH THE CELEBRATION — owner 2026-08-28: *"they get
// to use it until event day."* See THE WINDOW below.

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 12_000_000; // 12 MB — a phone JPEG is well under this
const MAX_CLIP_BYTES = 25_000_000; // ~25 MB — a short 1080p phone clip
// 10-SECOND CLIP CAP — owner override 2026-07-22 · §0. Mirrors the guest route
// (app/api/papic/guest-capture MAX_CLIP_MS); the DB CHECK on vendor_papic_captures
// was relaxed to 10000 in the same PR so a real 6–10s vendor clip records.
const MAX_CLIP_MS = 10000;
const MAX_POSTER_BYTES = 5_000_000;

export async function POST(req: Request) {
  // 1. Auth — the vendor is a signed-in Supabase user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  // 2. Counsel gate — fail-closed. No capture surface runs until the DPO ruling.
  if (!(await isVendorPapicCaptureEnabled())) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const eventId = typeof form.get('event_id') === 'string' ? String(form.get('event_id')).trim() : '';
  if (!eventId) {
    return NextResponse.json({ error: 'no_event' }, { status: 400 });
  }

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
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }
  }

  // 3. Guest-consent attestation (RA 10173). The controller's consent gate sends
  // consent='1'; absent → refuse. The lawful basis is recorded on the row; the
  // DPO/NPC ruling (which gates go-live) governs which basis is valid.
  if (form.get('consent') !== '1') {
    return NextResponse.json({ error: 'consent_required' }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  // 4. Resolve the vendor profile the caller owns/admins.
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: 'no_vendor' }, { status: 403 });
  }
  const vendorProfileId = profile.vendor_profile_id;

  // Clip extras: client-stamped duration (≤10s) + the poster frame (the NSFW proxy
  // — nsfwjs is image-only, we never classify the video bytes).
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
      posterFile.size <= MAX_POSTER_BYTES
    ) {
      posterBytes = new Uint8Array(await posterFile.arrayBuffer());
    }
  }

  const deviceModel =
    typeof form.get('device_model') === 'string'
      ? String(form.get('device_model')).slice(0, 120)
      : null;

  // 5. Tier + capture-points enforcement (service-role reads — provenance is
  // RLS-scoped to owner/admin, and the tier must be authoritative). Each tier's
  // point budget is the ceiling (photo=1, clip=7); free Lite is 50 pts + video.
  const admin = createAdminClient();
  // ⚠ THE CREDITS THEY HOLD ARE PART OF THE ALLOWANCE — owner 2026-09-05,
  // *"base it all from the supplier's shots per event"*: 5% of the booking fee
  // paid (cap 1,000, no floor) plus any ₱500/25 packs, summed from the
  // supplier's ledger (vendor_papic_portfolio_credit_grants, written on admin
  // payment approval). Until 2026-09-05 this read the booking fee itself at
  // ₱5/point; the owner said *"replace it."* The credits can only ever RAISE
  // the number (see `allowancePointsFor`), and an unread ledger is `null`,
  // which grants nothing — never a zero that would look like "they hold none".
  // ── THE WINDOW ────────────────────────────────────────────────────────────
  // Owner 2026-08-28: *"they get to use it until event day."* A supplier's
  // camera documents their own work, so it is open through the celebration and
  // shut once the celebration is over.
  //
  // 🔑 IT REUSES THE ONE RESOLVER RATHER THAN DEFINING "OVER" A SECOND TIME.
  // `getMenuLifecyclePhase` already answers it for the whole product — 06:00 in
  // the VENUE's clock on the day after `COALESCE(event_end_date, event_date)`,
  // or the moment the host presses "Close out the day". Six hours rather than
  // midnight because a Filipino reception runs past twelve; the last day rather
  // than the first because a festival's middle days are not "after". Every one
  // of those was argued out where that function lives, and re-deriving them
  // here is exactly the second opinion this codebase keeps paying for.
  //
  // ⚠ FAILS OPEN, deliberately. An unreadable event, a missing date or an
  // unrecognised timezone leaves the phase at 'plan' and the lane open — a
  // transient read failure must not silently stop a supplier capturing on the
  // one day they are standing at the venue. What closes this lane is a date we
  // could actually read.
  const { data: eventRow } = await admin
    .from('events')
    .select('event_date, event_end_date, timezone, cleared_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const ev = eventRow as {
    event_date: string | null;
    event_end_date: string | null;
    timezone: string | null;
    cleared_at: string | null;
  } | null;
  if (ev) {
    const phase = getMenuLifecyclePhase(
      ev.event_date,
      ev.cleared_at,
      ev.timezone ?? undefined,
      undefined,
      ev.event_end_date,
    );
    if (phase === 'after') {
      return NextResponse.json({ error: 'event_over' }, { status: 403 });
    }
  }

  const [tier, spent, creditsGranted] = await Promise.all([
    deriveVendorPapicTier(admin, vendorProfileId, eventId),
    fetchVendorPapicPointsSpent(admin, vendorProfileId, eventId),
    fetchVendorPapicCreditsGranted(admin, vendorProfileId, eventId),
  ]);
  const check = canCapture(tier, spent, mediaType, creditsGranted);
  if (!check.ok) {
    return NextResponse.json(
      { error: check.reason, tier, pointsSpent: spent },
      { status: check.reason === 'video_not_allowed' ? 403 : 409 },
    );
  }

  // 6. Upload to R2 (service-role client; the key prefix is server-derived so the
  // caller can never write outside their own vendor+event space).
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stamp = Date.now();
  const base = `papic/vendor-${vendorProfileId}/event-${eventId}/cap-${stamp}`;
  const key = isClip ? `${base}.mp4` : `${base}.jpg`;
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

  let posterRef: string | null = null;
  if (isClip && posterBytes) {
    try {
      const posterKey = `${base}-poster.jpg`;
      await r2Upload({
        bucket: R2_BUCKETS.media,
        key: posterKey,
        body: posterBytes,
        contentType: 'image/jpeg',
      });
      posterRef = `r2://${R2_BUCKETS.media}/${posterKey}`;
    } catch {
      // Poster upload failed → drop the bytes so the NSFW screen also skips (a
      // clip with no persisted poster must NOT get nsfw_checked=true and surface
      // as a posterless/blank tile — it stays unscreened, excluded).
      posterBytes = undefined;
    }
  }

  // 7. Record the capture under the vendor's RLS client. The insert policy
  // (vendor_papic_captures_vendor_insert) is the authoritative gate: it requires
  // event_id IN current_vendor_booked_event_ids() AND the caller's own vendor
  // profile — so an unbooked event or a non-owner is rejected here (42501).
  const { data: inserted, error: insErr } = await supabase
    .from('vendor_papic_captures')
    .insert({
      vendor_profile_id: vendorProfileId,
      event_id: eventId,
      r2_object_key: r2Ref,
      poster_r2_key: posterRef,
      media_type: mediaType,
      clip_duration_ms: isClip ? durationMs : null,
      device_model: deviceModel,
      consent_basis: 'event_consent',
      nsfw_checked: false,
    })
    .select('capture_id')
    .maybeSingle();
  if (insErr || !inserted) {
    // RLS rejection (not booked / not your profile) → 403; anything else → 500.
    const rls = insErr?.code === '42501';
    return NextResponse.json(
      { error: rls ? 'not_allowed' : 'record_failed' },
      { status: rls ? 403 : 500 },
    );
  }
  const captureId = (inserted as { capture_id: string }).capture_id;

  // 8. Always-on NSFW screen in the BACKGROUND so the shutter stays instant. We
  // hold the image bytes (photo) or poster bytes (clip) in memory — no R2 read.
  // A capture only surfaces once nsfw_checked=TRUE; a block also soft-hides it.
  // Fail-open: any classifier error leaves nsfw_checked=false (excluded), never
  // surfacing an unscreened photo.
  const proxyBytes = isClip ? posterBytes : bytes;
  after(async () => {
    if (!proxyBytes) return; // posterless clip → stays unscreened, excluded
    try {
      const decision = decideNsfw(await classifyImageBytes(proxyBytes));
      await admin
        .from('vendor_papic_captures')
        .update({
          nsfw_checked: true,
          hidden_at: decision === 'nsfw_blocked' ? new Date().toISOString() : null,
        })
        .eq('capture_id', captureId)
        .eq('nsfw_checked', false);
    } catch {
      // fail-open — the healing sweep / re-screen can retry
    }
  });

  // ── THE COUPLE'S COPY GOES OUT BEFORE THE ORIGINAL CAN GO AWAY ────────────
  //
  // 🔑 THE INVERSE COMES FIRST. Compression is destructive: after the retention
  // window the full-res original is deleted and the web copy becomes the
  // photograph. Drive is the ONLY way a couple keeps originals, so the sweep
  // refuses to drop anything whose key is not confirmed in the couple's Drive
  // copy (`isDriveDeferred`) — and NOTHING was enqueueing a supplier's captures.
  //
  // Without this, wiring the sweep would have been inert on precisely the events
  // where it matters: on a Drive-connected celebration a supplier's photograph
  // would defer forever, never dropped, the bill never falling. On an
  // unconnected one it would drop with no copy anywhere. Both wrong, in opposite
  // directions.
  //
  // A supplier's captures land in the COUPLE'S gallery, so they belong in the
  // couple's hand-off like any other photograph in it. Same helper, same
  // artifact type, same per-key dedup — no second copy path.
  //
  // Best-effort: a hand-off that fails leaves the key unconfirmed, which makes
  // the sweep DEFER rather than drop. The failure mode is a kept original.
  try {
    const { enqueueDriveCopy, runDriveCopyBatch } = await import('@/lib/drive-copy');
    await enqueueDriveCopy({
      eventId,
      artifactType: 'papic',
      files: [
        {
          r2ObjectKey: key,
          fileName: key.split('/').pop() || (isClip ? 'capture.webm' : 'capture.jpg'),
          mimeType: isClip ? 'video/webm' : 'image/jpeg',
          sourceTable: 'vendor_papic_captures',
          sourceRef: captureId,
        },
      ],
    });
    after(() => runDriveCopyBatch({ eventId }).catch(() => {}));
  } catch {
    // best-effort — an unconfirmed key makes the sweep defer, never drop.
  }

  // ── THE COMPRESSED WEB COPY (owner 2026-08-24: "compress it as well") ──────
  //
  // A supplier's photographs now get the SAME three AVIF sizes every other
  // photograph on the platform gets, from the SAME shared generator — a second
  // compression pipeline is the last thing this needs. The 1280px `display`
  // copy is what REPLACES the full-res original once the retention window
  // passes, so without it a supplier's originals sat at full size forever,
  // outside the model the public privacy notice describes.
  //
  // 🔑 WHY IT IS A SEPARATE after() HOOK AND NOT FOLDED INTO THE ONE ABOVE:
  // that one returns early on a posterless clip (`if (!proxyBytes) return`)
  // because there is nothing to SCREEN. A photo always has bytes, and folding
  // these together would tie compression to a screening precondition it does
  // not share. Two hooks, two reasons, neither able to skip the other.
  //
  // Best-effort by contract, like both existing call sites: the generator wraps
  // every path and returns nulls rather than throwing. A failure leaves
  // `display_r2_key` NULL, the row is then never a drop candidate, and the
  // original is simply kept. The failure mode is a bigger bill, never a lost
  // photograph.
  //
  // ⛔ A CLIP'S VIDEO IS NOT TRANSCODED HERE, and cannot be: Vercel has no
  // ffmpeg, and the couple-side web copy is made by the GUEST'S OWN BROWSER and
  // uploaded as a finished file. What DOES happen for a clip is the still —
  // `generateClipThumb` derives tile + thumb from the poster and points
  // `display_r2_key` at the poster itself, so the gallery side compresses even
  // though the video keeps its original.
  after(async () => {
    try {
      const { generatePhotoDerivatives, generateClipThumb } = await import(
        '@/lib/papic-derivatives'
      );
      if (isClip) {
        if (posterRef) {
          await generateClipThumb(
            posterRef,
            'vendor_papic_captures',
            'capture_id',
            captureId,
          );
        }
      } else {
        await generatePhotoDerivatives(
          r2Ref,
          'vendor_papic_captures',
          'capture_id',
          captureId,
        );
      }
    } catch {
      // Best-effort: no web copy means the original is kept, never dropped.
    }
  });

  return NextResponse.json({
    status: 'ok',
    captureId,
    tier,
    mediaType,
    points: pointsForMedia(mediaType),
  });
}
