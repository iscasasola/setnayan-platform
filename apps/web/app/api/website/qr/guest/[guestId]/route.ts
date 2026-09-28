import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderInvitationQrPng } from '@/lib/qr';
import { QR_LOOK_COLUMNS, resolveEventQrLook } from '@/lib/qr-look.server';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { logQueryError } from '@/lib/supabase/error-detect';
import { guestQrFileName } from '@/app/api/guest/qr/route';

/**
 * GET /api/website/qr/guest/[guestId] — a single guest's invitation QR as a
 * PNG, in the event's LOOK, for the couple's side: the guest drawer's preview
 * and its Download button, and the Invitation page's per-guest downloads.
 *
 * ── THE LOOK, NOT A PRODUCT (owner 2026-09-27) ─────────────────────────────
 * Until this build the route served the "Custom QR per guest" product — the
 * couple's palette in the modules — and was GATED on that SKU
 * (`CUSTOM_QR_GUEST`). That product folded into Event Hub Pro: a free event's
 * code carries the Setnayan mark; a Pro event's carries the couple's logo,
 * shape, pattern and palette ink. `resolveEventQrLook` decides, so this route
 * no longer asks about any SKU — it draws whatever the event's look is, which
 * is exactly what the guest's own /api/guest/qr and every print draw.
 *
 * AUTHENTICATED, still — this is the couple's side:
 *   1. The guest is read via the USER-scoped Supabase client, so RLS blocks
 *      anyone who isn't a member of the guest's event (no public read). A
 *      non-member (or signed-out caller) gets no row → 404.
 *   2. The event row and the ownership read run with the admin client AFTER
 *      that authorization — Pro is an event-level fact while `orders` RLS is
 *      purchaser-scoped, so a co-host who didn't place the order would
 *      otherwise be shown the free look.
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

  // RLS scopes this read to events the user is a member of.
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

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    // The CANONICAL monogram list + the look's own two columns.
    .select(`event_id, slug, ${QR_LOOK_COLUMNS}`)
    .eq('event_id', guest.event_id)
    .maybeSingle();
  if (!event) {
    return new NextResponse('Event not found.', { status: 404 });
  }

  const look = await resolveEventQrLook(admin, event.event_id, event);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const slug = event.slug ?? event.event_id;
  // Canonical URL form — nested /u/ under the cutover flag, bare root otherwise.
  const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);

  // 1024px keeps the printed PNG crisp at postcard / table-card sizes. The url
  // is built by buildInvitationUrl inside the renderer — this route never
  // spells it, so the card and the download cannot drift apart.
  let markError: unknown = null;
  const png = await renderInvitationQrPng({
    appUrl,
    slug,
    qrToken: guest.qr_token,
    ownerSlug,
    look,
    onMonogramError: (err) => {
      markError = err;
      logQueryError('GuestQrPng.look', err, { eventId: event.event_id }, 'graceful_degrade');
    },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'X-Setnayan-Monogram': markError ? 'fallback' : 'composited',
      // Private cache only — this is a per-guest, member-only asset. Re-derived
      // each visit (slug/look/token can change), so keep the window short.
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
