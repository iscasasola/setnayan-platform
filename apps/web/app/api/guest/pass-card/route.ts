import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getHostUserId } from '@/lib/host-gate';
import { readGuestSession } from '@/lib/guest-session';
import { PASS_CARD_REFUSED, PASS_CARD_WORDS, decidePassCardAccess } from '@/lib/pass-card';
import { REQUEST_WORDS } from '@/lib/request-key';
import {
  asPassCardRow,
  loadPassCardKit,
  passCardDesignFor,
  passCardFileNameFor,
  passCardVersion,
  readPassCardGuest,
  renderPassCardFor,
} from '@/lib/pass-card.server';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * GET /api/guest/pass-card[?guest=<uuid>][&design=classic] — ONE guest's pass
 * card, the 1080 × 1440 PNG "Save to Photos" keeps (lib/pass-card.ts). It is
 * ALSO the picture the guest's Event Hub shows (`GuestTicketCard`, 2026-09-30),
 * so what they see and what they save are one file. The look is the couple's
 * pick unless `design` asks for another (`passCardDesignFor`).
 *
 * 🔒 WHO — `decidePassCardAccess`, pure and tested:
 *   · the signed guest session (`setnayan_guest_session`, httpOnly — the same
 *     credential /api/guest/qr trusts), for ITSELF with no `guest`, or for a
 *     plus-one it brought (`guest=<their id>`);
 *   · or a signed-in HOST of the guest's event (owner 2026-09-29: "downloading
 *     them individually is free" — no Pro question here; only the zip is Pro).
 * Nothing in the address is a credential: no token, no slug, no name. A guest
 * id is not a key — without the cookie or the host's sign-in it opens nothing.
 *
 * 🛂 WHAT — only a card that EXISTS: accepted by the couple and not "can't
 * come" (owner: "only accepted accounts get their images" · "no pass for those
 * who cannot come"). Enforced HERE, not by a hidden button. Every refusal after
 * sign-in is ONE 404 with ONE body — pending, can't come, not yours and no such
 * guest are indistinguishable, so this cannot be asked who is on a list.
 *
 * ⚡ CACHE — per guest + version: the ETag names every input the card is drawn
 * from (`passCardVersion`: the code, the facts, the look, the build), so a
 * repeat save is a 304 without a render, and a rotated code, a new table or a
 * new logo is a new picture. `private` — the QR signs its holder in, so it never
 * sits in a shared cache.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function callerIsHost(eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // getHostUserId redirects when nobody is signed in — ask first.
  if (!user) return false;
  return (await getHostUserId(eventId)) !== null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const asked = url.searchParams.get('guest');
  if (asked !== null && !UUID.test(asked)) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  const session = await readGuestSession();
  const guestId = asked ?? session?.guest_id ?? null;
  if (!guestId) return new NextResponse('Open your invitation link first.', { status: 401 });

  const admin = createAdminClient();
  const { target, bringer, failed } = await readPassCardGuest(admin, guestId);

  // The host question is asked only when the session does not already cover
  // this seat — a guest saving their own card never touches the auth server.
  const sessionCovers =
    Boolean(session && target && session.event_id === target.event_id) &&
    (target!.guest_id === session!.guest_id || target!.plus_one_of_guest_id === session!.guest_id);
  const isHost = !sessionCovers && target ? await callerIsHost(target.event_id) : false;

  const verdict = decidePassCardAccess({
    session,
    isHost,
    target: target ? asPassCardRow(target) : null,
    bringer: bringer ? asPassCardRow(bringer) : null,
    readFailed: failed,
  });
  if (!verdict.allow) return new NextResponse(verdict.message, { status: verdict.status });
  if (!target) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  const kit = await loadPassCardKit(admin, target.event_id, { seatsFor: [target.guest_id] });
  if (!kit?.set.event.slug) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  const design = passCardDesignFor(kit, url.searchParams.get('design'));

  // 🔓 A waiting guest's own seat: the "Request pending" ticket — the SAME
  // drawing `/api/guest/request-ticket` hands a requester on Send, so the Event
  // Hub and the file never disagree. Never cached: it 404s or turns into the
  // real ticket the moment the couple decides.
  if (verdict.pending) {
    const couple = (kit.set.event.display_name ?? '').trim() || 'the couple';
    try {
      const png = await renderPassCardFor(kit, target, 'classic', { pending: REQUEST_WORDS.bandSub(couple) });
      return new NextResponse(Buffer.from(png), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${passCardFileNameFor(kit, target)}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (err) {
      logQueryError('pass-card.render-pending', err, { guest_id: target.guest_id }, 'graceful_degrade');
      return new NextResponse(`Could not draw your ${PASS_CARD_WORDS.noun} just now. Try again.`, { status: 503 });
    }
  }

  const etag = `"${passCardVersion(kit, target, design)}"`;
  const headers = {
    'Content-Type': 'image/png',
    'Content-Disposition': `attachment; filename="${passCardFileNameFor(kit, target)}"`,
    'Cache-Control': 'private, no-cache',
    ETag: etag,
  };
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers });

  try {
    const png = await renderPassCardFor(kit, target, design);
    return new NextResponse(Buffer.from(png), { status: 200, headers });
  } catch (err) {
    logQueryError('pass-card.render', err, { guest_id: target.guest_id }, 'graceful_degrade');
    return new NextResponse(`Could not draw your ${PASS_CARD_WORDS.noun} just now. Try again.`, { status: 503 });
  }
}
