import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { canViewSlugEvent } from '@/lib/slug-access';
import { userHostsEvent } from '@/lib/events';
import { parseStoredAsset } from '@/lib/uploads';
import { r2GetBytes } from '@/lib/r2';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * GET /api/pabuya/qr/[publicId] — the couple's uploaded e-gift QR image, at a
 * PERMANENT URL.
 *
 * ── WHY THIS ROUTE EXISTS ──────────────────────────────────────────────────
 * The QR used to be handed to the browser as an R2 presigned GET with a
 * 24-hour TTL. A wedding gift page is published once and read for months, so
 * an expiring URL is the wrong shape: a page regenerated more than a day
 * later, a tab left open overnight, or a link somebody saved all render a
 * broken image — and a broken QR on a gift page looks like the couple got
 * their payment details wrong. Raising the TTL cannot fix it either; SigV4
 * caps a presigned URL at seven days (see lib/pabuya-qr-url.ts).
 *
 * ── THE GATE — the id is NOT the access control ────────────────────────────
 * `public_id` is a random S89Y-<10 Crockford> handle, but this route never
 * treats "you knew the id" as "you may see it". Two ways in, and they are
 * deliberately different:
 *
 *   • A HOST of the event (couple member or accepted moderator, via the shared
 *     `userHostsEvent`) may fetch ANY of their own methods — including a
 *     DISABLED one, because the dashboard's edit thumbnail has to render a
 *     destination the couple has hidden from guests.
 *   • Everyone else must clear BOTH `is_enabled` AND `canViewSlugEvent` — the
 *     same visibility gate /[slug]/pabuya itself applies. So this route opens
 *     exactly when that page opens, and not one case wider.
 *
 * 🔑 THE `is_enabled` HALF IS THE EASY ONE TO DROP, AND IT IS LOAD-BEARING.
 * Hiding a destination is how a couple retires an account — the row keeps the
 * old bank details. Gating only on event visibility would keep serving that
 * retired QR from a public URL forever, which is worse than the expiry this
 * route was written to remove.
 *
 * ⚠ NOT `PABUYA_PUBLIC_ROUTE_ENABLED`-gated, on purpose. That flag hides the
 * public guest PAGE while it is still being rolled out; the couple's own
 * dashboard preview renders today and needs these bytes today. A guest who
 * cannot reach the page has no id to ask with, and if they somehow had one the
 * visibility gate above still answers.
 *
 * Cache: `private, max-age=300`. Private because the bytes can be gated, and
 * short because the URL is STABLE across a replacement — the couple swapping
 * their QR keeps the same public_id, so a long/immutable cache would pin the
 * old image. Five minutes matches the public page's own `revalidate`.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await ctx.params;
  if (!publicId || typeof publicId !== 'string' || publicId.length > 64) {
    return new NextResponse('Invalid QR reference.', { status: 400 });
  }

  const admin = createAdminClient();

  const { data: methodRow, error: methodError } = await admin
    .from('event_egift_methods')
    .select('event_id, qr_r2_key, is_enabled, label')
    .eq('public_id', publicId)
    .maybeSingle();

  // 🔑 A REFUSED READ IS NOT A MISSING ROW. Answering 404 on a broken query
  // would render as "this couple has no QR" — the exact confusion this whole
  // change exists to remove. 502 says the truth: we could not look.
  if (methodError) {
    logQueryError(
      'PabuyaQrRoute.method',
      methodError,
      { public_id: publicId },
      'graceful_degrade',
    );
    return new NextResponse('Could not load this QR code.', { status: 502 });
  }

  const method = methodRow as {
    event_id: string;
    qr_r2_key: string | null;
    is_enabled: boolean;
    label: string | null;
  } | null;

  if (!method || !method.qr_r2_key) {
    return new NextResponse('No QR code here.', { status: 404 });
  }

  const { data: eventRow, error: eventError } = await admin
    .from('events')
    .select('landing_page_visibility')
    .eq('event_id', method.event_id)
    .maybeSingle();
  if (eventError) {
    logQueryError(
      'PabuyaQrRoute.event',
      eventError,
      { event_id: method.event_id },
      'graceful_degrade',
    );
    return new NextResponse('Could not load this QR code.', { status: 502 });
  }
  const visibility =
    (eventRow as { landing_page_visibility: string | null } | null)
      ?.landing_page_visibility ?? null;

  // ── Host arm: their own event, enabled or not. ────────────────────────────
  let isHost = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Admin client on purpose: membership is an EVENT-level fact and the
      // user's own RLS view of event_members/event_moderators can be narrower
      // than the truth for a co-host. Authorization is the check below, not
      // the client that ran it.
      isHost = await userHostsEvent(admin, user.id, method.event_id);
    }
  } catch {
    // A failed host lookup must not ESCALATE — fall through to the guest arm,
    // which is the stricter of the two.
    isHost = false;
  }

  if (!isHost) {
    if (!method.is_enabled) {
      return new NextResponse('No QR code here.', { status: 404 });
    }
    if (!(await canViewSlugEvent(method.event_id, visibility))) {
      return new NextResponse('This gift page is not open.', { status: 403 });
    }
  }

  // ── The bytes. ────────────────────────────────────────────────────────────
  const ref = parseStoredAsset(method.qr_r2_key);
  if (!ref) return new NextResponse('No QR code here.', { status: 404 });

  // A pre-R2 row may hold an external https URL the couple pasted. Send them
  // there rather than pretending we hold the bytes.
  if (ref.kind === 'legacy_url') {
    return NextResponse.redirect(ref.url, 307);
  }

  let bytes: Uint8Array;
  let contentType: string | null;
  try {
    ({ bytes, contentType } = await r2GetBytes({
      bucket: ref.bucket,
      key: ref.key,
    }));
  } catch {
    return new NextResponse('Could not load this QR code.', { status: 502 });
  }

  // Only ever answer as an image. The uploader accepts image types only, but
  // this route is the thing a browser trusts — a stored content-type is data,
  // not a promise, and echoing an arbitrary one back would let a bad row pick
  // the type the browser renders it as.
  const safeType =
    contentType && contentType.startsWith('image/') ? contentType : 'image/png';

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': safeType,
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
