import { NextResponse, after } from 'next/server';
import { parseClientRef } from '@/lib/r2-client-ref';
import { probeMp4DurationMs } from '@/lib/papic-upload-intents.server';
import { albumVideoCredits } from '@/lib/album-video-cost';
import { checkSupplierStorage } from '@/lib/supplier-storage.server';
import { STORAGE_CHECK_FAILED, STORAGE_FULL_CODE, STORAGE_UPGRADE_HREF } from '@/lib/supplier-storage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Delete, r2Head, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { classifyImageBytes, decideNsfw } from '@/lib/nsfw-screen';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { fetchVendorPapicPortfolioCredits } from '@/lib/vendor-papic-grants';
import { revalidateShopPage } from '@/lib/shop-page-cache';

// POST /api/vendor/papic-portfolio-import
//
// A supplier importing ONE finished photo into their PRIVATE portfolio album
// for a booked event (G3, following G2's credit ledger). Distinct in kind from
// /api/vendor/papic-capture: that route is the on-the-day camera shooting
// somebody else's wedding; this route is the supplier paying a credit to add
// their own finished work to their own marketing album. No guest is
// photographed here, so there is no RA 10173 consent gate and no "shutter
// closes when the celebration ends" window — a supplier curates their
// portfolio whenever they like, on the day or months later.
//
// Storage prefix is a THIRD lane, never the host gallery's and never the
// on-the-day capture lane's: papic/vendor-{id}/portfolio/{eventId}/{uuid}.jpg
// — pinned by tests/db/vendor-papic-portfolio-is-not-the-host-gallery.db.test.ts.
//
// Same shape as every other Papic ingest route: validate → check the credit
// balance → PUT to R2 with the service-role client → insert under the
// vendor's own RLS client (the insert policy is the hard booked/own-profile
// gate) → NSFW-screen in the background (always-on, cannot be disabled).

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 12_000_000; // 12 MB — matches the capture route's cap

/** A video's length could not be read from the file — said, never priced by a guess. */
const VIDEO_LENGTH_UNREAD = 'We couldn’t read how long that video is, so nothing was charged. Save it as an MP4 or MOV and try again.';

export async function POST(req: Request) {
  // 1. Auth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  // 2. The vendor Papic lane's own kill-switch. The whole surface this route
  // serves lives behind the same admin Data Privacy control as the camera —
  // if that control is off there is nowhere in the product this button
  // renders, and the route backstops it the same way the capture route does.
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

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'uploads_unavailable' }, { status: 503 });
  }

  // 3. Resolve the vendor profile the caller owns/admins.
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: 'no_vendor' }, { status: 403 });
  }
  const vendorProfileId = profile.vendor_profile_id;

  // 3b. 🎬 A VIDEO (owner 2026-11-13: the Ultra album holds photos AND videos). The phone uploaded the MP4 to the shop's
  // OWN album folder and sends its screened still as `file` (the still is what the NSFW screen reads — same posture as
  // every Papic clip, lib/clip-poster.ts). The SERVER measures the video's size and length itself; the length prices it
  // (owner 2026-11-14: "x3 of the video based on their seconds as compared to papic" — `albumVideoCredits`). A video
  // whose length cannot be read is refused, never priced by a guess.
  const videoRefRaw = form.get('video_ref');
  let video: { ref: string; bytes: number } | null = null;
  let credits = 1;
  if (typeof videoRefRaw === 'string' && videoRefRaw) {
    const at = parseClientRef(videoRefRaw, { bucket: R2_BUCKETS.media, prefixes: [`vendors/${vendorProfileId}/album/${eventId}/`] });
    if (!at) return NextResponse.json({ error: 'bad_video' }, { status: 400 });
    const head = await r2Head({ bucket: at.bucket, key: at.key });
    if (!head || !Number.isFinite(head.size) || head.size <= 0) return NextResponse.json({ error: 'bad_video' }, { status: 400 });
    const ref = `r2://${at.bucket}/${at.key}`;
    const measuredMs = await probeMp4DurationMs(ref, head.size);
    const priced = albumVideoCredits(measuredMs);
    if (priced === null) {
      await r2Delete({ bucket: at.bucket, key: at.key }).catch(() => undefined);
      return NextResponse.json({ error: 'video_length_unread', message: VIDEO_LENGTH_UNREAD }, { status: 422 });
    }
    video = { ref, bytes: head.size };
    credits = priced;
  }
  // Nothing new is stored on a refusal below — a video that was uploaded first is removed again.
  const dropVideo = async () => {
    if (video) {
      const at = parseClientRef(video.ref, { bucket: R2_BUCKETS.media, prefixes: [`vendors/${vendorProfileId}/album/${eventId}/`] });
      if (at) await r2Delete({ bucket: at.bucket, key: at.key }).catch(() => undefined);
    }
  };

  // 4. THE CREDIT CHECK. One meter per (vendor, event) — the same "left" the
  // supplier's own readout shows, already reduced by both doors (on-the-day
  // capture AND prior portfolio imports). Re-checked here rather than trusted
  // from the client, the same posture canCapture uses for the camera. `null`
  // means Unli (uncapped) — nothing to check.
  const admin = createAdminClient();
  const { left } = await fetchVendorPapicPortfolioCredits(admin, vendorProfileId, eventId);
  if (left != null && left < credits) {
    await dropVideo();
    return NextResponse.json({ error: 'out_of_credits', left, needs: credits }, { status: 409 });
  }

  // 4b. 💾 THE PLAN'S STORAGE (owner 2026-11-13: the album is "counted in the supplier's plan storage"). Asked BEFORE
  // the bytes move, the same question /api/upload asks (`checkSupplierStorage`); a check that could not be made refuses
  // (a cap that waves uploads through when blind is no cap). Nothing is spent or stored on a refusal.
  const room = await checkSupplierStorage(admin, vendorProfileId, file.size + (video?.bytes ?? 0));
  if (room.kind === 'full') {
    await dropVideo();
    return NextResponse.json({ error: STORAGE_FULL_CODE, message: room.message, href: STORAGE_UPGRADE_HREF }, { status: 413 });
  }
  if (room.kind === 'unavailable') {
    await dropVideo();
    return NextResponse.json({ error: 'storage_unchecked', message: STORAGE_CHECK_FAILED }, { status: 503 });
  }

  // 5. Upload to R2 — the key prefix is server-derived so the caller can never
  // write outside their own vendor+event space, and it is its OWN lane,
  // distinct from both the host gallery and papic/vendor-{id}/event-{id}/cap-…
  // (the on-the-day capture lane).
  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `papic/vendor-${vendorProfileId}/portfolio/${eventId}/${crypto.randomUUID()}.jpg`;
  try {
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: bytes,
      contentType: 'image/jpeg',
    });
  } catch {
    await dropVideo();
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }
  const r2Ref = `r2://${R2_BUCKETS.media}/${key}`;

  // 6. Record the import under the vendor's RLS client. The insert policy
  // (vendor_papic_portfolio_photos_vendor_insert) is the authoritative gate:
  // it requires event_id IN current_vendor_booked_event_ids() AND the
  // caller's own vendor profile — an unbooked event or a non-owner is
  // rejected here (42501), independent of the credit check above.
  const { data: inserted, error: insErr } = await supabase
    .from('vendor_papic_portfolio_photos')
    .insert({
      vendor_profile_id: vendorProfileId,
      event_id: eventId,
      r2_object_key: r2Ref,
      credits_spent: credits,
      nsfw_checked: false,
      // 💾 Counted in the plan's storage (`vendor_storage_used_bytes`) — the bytes actually stored, measured here.
      size_bytes: bytes.byteLength + (video?.bytes ?? 0),
      media_kind: video ? 'video' : 'photo',
      video_r2_key: video ? video.ref : null,
    })
    .select('photo_id')
    .maybeSingle();
  if (insErr || !inserted) {
    await dropVideo();
    const rls = insErr?.code === '42501';
    return NextResponse.json(
      { error: rls ? 'not_allowed' : 'record_failed' },
      { status: rls ? 403 : 500 },
    );
  }
  const photoId = (inserted as { photo_id: string }).photo_id;

  // 7. Always-on NSFW screen in the BACKGROUND, same posture as every other
  // Papic ingest path — a row only surfaces once nsfw_checked=TRUE, fail-open
  // (a classifier error leaves it unscreened and excluded, never surfacing
  // unchecked content).
  after(async () => {
    try {
      const decision = decideNsfw(await classifyImageBytes(bytes));
      await admin
        .from('vendor_papic_portfolio_photos')
        .update({
          nsfw_checked: true,
          hidden_at: decision === 'nsfw_blocked' ? new Date().toISOString() : null,
        })
        .eq('photo_id', photoId)
        .eq('nsfw_checked', false);
    } catch {
      // fail-open — the row stays unscreened/excluded until a re-screen retries
    }
  });

  revalidateShopPage(vendorProfileId);
  return NextResponse.json({ ok: true, photoId });
}
