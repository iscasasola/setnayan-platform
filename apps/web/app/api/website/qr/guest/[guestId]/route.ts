import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPrimaryColor, sanitizeRolePalette } from '@/lib/mood-board';
import { renderBrandedInvitationQrPng, resolveBrandedQrColors } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventSkuActive } from '@/lib/entitlements';
import { guestQrFileName } from '@/app/api/guest/qr/route';

/**
 * GET /api/website/qr/guest/[guestId] — serves a single guest's BRANDED
 * invitation QR as a palette-tinted PNG. Drives the "Download PNG" affordance
 * on the owned Custom QR per guest surface
 * (/dashboard/[eventId]/studio/custom-qr-guest).
 *
 * Closes the partial CUSTOM_QR_GUEST SKU (₱1,499) — the PNG carries the
 * couple's Mood Board palette color in its modules AND their monogram in the
 * centre, the same mark the on-screen card shows.
 *
 * ⚠ CORRECTED 2026-09-16 (owner decision #19). This docblock used to say the
 * PNG path "does NOT composite the center monogram (compositeMonogram operates
 * on raw SVG)" and called the bare file "the bulletproof shareable PNG". The
 * cause was a real limitation of one function; the conclusion was wrong about
 * the product, because the downloaded picture is the one that gets printed and
 * handed to a guest who has no email address. See lib/qr-monogram-raster.ts.
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
    // first_name/display_name are read ONLY so the saved file is named after
    // the guest (guestQrFileName, shared with /api/guest/qr) — the same
    // reason that route reads them.
    .select('guest_id, event_id, qr_token, first_name, display_name')
    .eq('guest_id', guestId)
    .maybeSingle();
  if (!guest) {
    return new NextResponse('Guest not found.', { status: 404 });
  }

  const { data: event } = await supabase
    .from('events')
    // The CANONICAL monogram list — see the note in /api/guest/qr.
    .select(`event_id, slug, role_palette, ${HERO_MONOGRAM_COLUMNS}`)
    .eq('event_id', guest.event_id)
    .maybeSingle();
  if (!event) {
    return new NextResponse('Event not found.', { status: 404 });
  }

  // Ownership gate — the branded PNG is a paid feature. The guest + event reads
  // above (under the user's RLS) ARE the authorization: a non-member can't see
  // the guest row → 404, so by here the caller is an authorized event member.
  // Ownership is an EVENT-level fact, but orders RLS is purchaser-scoped
  // (user_id = auth.uid()), so reading it with the user client would deny a
  // co-host member who didn't personally place the order (PR4d). Read it with
  // the admin client instead — event-scoped, post-authorization, safe.
  // eventOwnsSku is bundle-aware + refund-aware; it THROWS on a non-graceful DB
  // error, so we wrap it to keep this route's existing 500 (not an uncaught throw).
  let owns = false;
  try {
    owns = await eventSkuActive(createAdminClient(), guest.event_id, 'CUSTOM_QR_GUEST');
  } catch {
    return new NextResponse('Could not verify your upgrade.', { status: 500 });
  }
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
  // Canonical URL form — nested /u/ under the cutover flag, bare root otherwise
  // (resolve self-noops OFF; no query pre-cutover). Read with admin: ownership
  // is event-level and event_members/users may be RLS-invisible to a co-host.
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), event.event_id);

  // 1024px keeps the printed PNG crisp at postcard / table-card sizes. The url
  // is built by buildInvitationUrl inside the renderer — this route no longer
  // spells it, so the branded card and the branded download cannot drift apart.
  let markError: unknown = null;
  const png = await renderBrandedInvitationQrPng({
    appUrl,
    slug,
    qrToken: guest.qr_token,
    ownerSlug,
    colors,
    monogram: resolveMonogram(event),
    onMonogramError: (err) => {
      markError = err;
      logQueryError('BrandedGuestQrPng.monogram', err, { eventId: event.event_id }, 'graceful_degrade');
    },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'X-Setnayan-Monogram': markError ? 'fallback' : 'composited',
      // Private cache only — this is a per-guest, gated asset. Re-derived each
      // visit (slug/palette/token can change), so keep the window short.
      'Cache-Control': 'private, max-age=300',
      // 🚨 THIS WAS MISSING (owner, 2026-09-25: "when we try to download the
      // QR code... it should just save and not open a new page"). Every other
      // saved-QR route (/api/guest/qr) names the file on the wire; this one
      // didn't, so a browser that ignores the anchor's `download` attribute —
      // which iOS Safari and the Capacitor iOS shell both do for a same-origin
      // GET — rendered the PNG as a page instead of saving it. Naming the file
      // here is what makes a bare `<a download>` (and the fetch→blob fallback
      // in SaveFileLink) actually save rather than navigate.
      'Content-Disposition': `attachment; filename="${guestQrFileName(guest.first_name, guest.display_name)}"`,
    },
  });
}
