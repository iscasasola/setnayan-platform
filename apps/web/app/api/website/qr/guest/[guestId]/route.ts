import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { getPrimaryColor, sanitizeRolePalette } from '@/lib/mood-board';
import { resolveBrandedQrColors } from '@/lib/qr';

/**
 * GET /api/website/qr/guest/[guestId] — serves a single guest's BRANDED
 * invitation QR as a palette-tinted PNG. Drives the "Download PNG" affordance
 * on the owned Custom QR per guest surface
 * (/dashboard/[eventId]/add-ons/custom-qr-guest).
 *
 * Closes the partial CUSTOM_QR_GUEST SKU (₱1,499) — the PNG carries the
 * couple's Mood Board palette color in its modules. Like the master event QR
 * endpoint (/api/website/qr/[slug]), the PNG path does NOT composite the
 * center monogram (compositeMonogram operates on raw SVG); the on-screen card
 * shows the full monogram-composited SVG, and this download is the
 * bulletproof shareable PNG.
 *
 * GATED — unlike the public master-QR endpoint, this is authenticated:
 *   1. We read the guest via the USER-scoped Supabase client, so RLS blocks
 *      anyone who isn't a member of the guest's event (no public read).
 *   2. We additionally require the event to OWN a paid CUSTOM_QR_GUEST order
 *      (not cancelled/refunded/lapsed) — so an event member who hasn't
 *      purchased the upgrade can't pull the branded PNG.
 *
 * This is the ONLY place a NEW per-guest QR query runs for the branded
 * variant, and it never executes on an always-rendered page — it fires only
 * when a user clicks Download on the owned (gated) surface.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ guestId: string }> },
) {
  const { guestId } = await ctx.params;

  if (!guestId || typeof guestId !== 'string') {
    return new NextResponse('Invalid guest.', { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse('Sign in to download this QR.', { status: 401 });
  }

  // RLS scopes this read to events the user is a member of. A non-member
  // (or signed-out caller) gets no row → 404.
  const { data: guest } = await supabase
    .from('guests')
    .select('guest_id, event_id, qr_token')
    .eq('guest_id', guestId)
    .maybeSingle();
  if (!guest) {
    return new NextResponse('Guest not found.', { status: 404 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('event_id, slug, role_palette, monogram_color')
    .eq('event_id', guest.event_id)
    .maybeSingle();
  if (!event) {
    return new NextResponse('Event not found.', { status: 404 });
  }

  // Ownership gate — the branded PNG is a paid feature. Graceful-degrade on a
  // missing orders table (42P01 / 42703) by treating it as not-owned.
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', guest.event_id)
    .eq('service_key', 'CUSTOM_QR_GUEST')
    .not('status', 'in', '("cancelled","refunded","lapsed")');
  if (ordersError && ordersError.code !== '42P01' && ordersError.code !== '42703') {
    return new NextResponse('Could not verify your upgrade.', { status: 500 });
  }
  const owns = (orders ?? []).length > 0;
  if (!owns) {
    return new NextResponse('This branded QR is part of the Custom QR upgrade.', {
      status: 403,
    });
  }

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const brandColor =
    getPrimaryColor(palette, 'reception') ??
    getPrimaryColor(palette, 'bride') ??
    getPrimaryColor(palette, 'ceremony') ??
    event.monogram_color ??
    null;
  const colors = resolveBrandedQrColors(brandColor);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const slug = event.slug ?? event.event_id;
  const url = `${appUrl}/${slug}?invite=${guest.qr_token}`;

  // 1024px keeps the printed PNG crisp at postcard / table-card sizes.
  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: 1024,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: { dark: colors.dark, light: colors.light },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Private cache only — this is a per-guest, gated asset. Re-derived each
      // visit (slug/palette/token can change), so keep the window short.
      'Cache-Control': 'private, max-age=300',
    },
  });
}
