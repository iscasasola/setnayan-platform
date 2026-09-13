import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { classifyImageBytes, decideNsfw } from '@/lib/nsfw-screen';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { fetchVendorPapicPortfolioCredits } from '@/lib/vendor-papic-grants';

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

  // 4. THE CREDIT CHECK. One meter per (vendor, event) — the same "left" the
  // supplier's own readout shows, already reduced by both doors (on-the-day
  // capture AND prior portfolio imports). Re-checked here rather than trusted
  // from the client, the same posture canCapture uses for the camera. `null`
  // means Unli (uncapped) — nothing to check.
  const admin = createAdminClient();
  const { left } = await fetchVendorPapicPortfolioCredits(admin, vendorProfileId, eventId);
  if (left != null && left < 1) {
    return NextResponse.json({ error: 'out_of_credits', left }, { status: 409 });
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
      credits_spent: 1,
      nsfw_checked: false,
    })
    .select('photo_id')
    .maybeSingle();
  if (insErr || !inserted) {
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

  return NextResponse.json({ ok: true, photoId });
}
