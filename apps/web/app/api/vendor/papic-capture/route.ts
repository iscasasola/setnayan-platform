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
} from '@/lib/vendor-papic-grants';
import { canCapture, pointsForMedia } from '@/lib/vendor-papic-tier';

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
// ⚠️ COUNSEL-GATED: this whole surface is gated by isVendorPapicCaptureEnabled()
// (the admin Data Privacy control `vendor_papic_capture`, default OFF). Until the
// DPO/NPC ruling flips it, this route 403s and no guest PI is collected. Geo is
// never stored; the 10s clip cap is a product lock; NSFW is always-on.

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
  // RLS-scoped to owner/admin, and the tier must be authoritative). Lite is
  // photos-only; each tier's point budget is the ceiling (photo=1, clip=7).
  const admin = createAdminClient();
  const [tier, spent] = await Promise.all([
    deriveVendorPapicTier(admin, vendorProfileId, eventId),
    fetchVendorPapicPointsSpent(admin, vendorProfileId, eventId),
  ]);
  const check = canCapture(tier, spent, mediaType);
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

  if (isClip && posterBytes) {
    try {
      await r2Upload({
        bucket: R2_BUCKETS.media,
        key: `${base}-poster.jpg`,
        body: posterBytes,
        contentType: 'image/jpeg',
      });
    } catch {
      // best-effort — a posterless clip just stays unscreened (never surfaced)
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

  return NextResponse.json({
    status: 'ok',
    captureId,
    tier,
    mediaType,
    points: pointsForMedia(mediaType),
  });
}
