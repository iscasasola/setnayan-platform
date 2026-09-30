import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PASS_CARD_REFUSED, PASS_CARD_WORDS } from '@/lib/pass-card';
import { loadPassCardKit, passCardFileNameFor, readPassCardGuest, renderPassCardFor } from '@/lib/pass-card.server';
import { REQUEST_WORDS } from '@/lib/request-key';
import { REQUEST_KEY_COOKIE, readRequestKeyByToken } from '@/lib/request-key.server';

/**
 * GET /api/guest/request-ticket — a REQUESTER'S Digital ticket in its "Request
 * pending" state (owner 2026-09-29, DECISION_LOG "IT IS THEIR DIGITAL TICKET, IN
 * A 'REQUEST PENDING' STATE"; prototype guest_ticket_flow_2026-09-29.html frame B).
 *
 * 🔒 WHO — only this browser's remembered request (`sn_request_key`, httpOnly,
 * set on Send). Nothing in the address is a credential.
 * 🛂 WHAT — only while the request is PENDING. Accepted or Linked, the guest's
 * real ticket comes from `/api/guest/pass-card` (their invitation now opens);
 * declined, there is no ticket. Every refusal is the same 404 as the pass-card
 * route's, so this cannot be asked who is on a list.
 *
 * The same card, the same file name (`<Guest>-ticket-<Couple>-<date>.png`), the
 * same QR — with no Table / Arrive, a dashed "Request pending" band and "Not
 * valid at the door yet". The door checks live, so the picture never admits on
 * its own (lib/request-key.ts `doorVerdict`).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const key = await readRequestKeyByToken((await cookies()).get(REQUEST_KEY_COOKIE)?.value);
  if (!key) return new NextResponse('Open your link first.', { status: 401 });
  if (key.state.kind !== 'pending') return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  const admin = createAdminClient();
  const { target } = await readPassCardGuest(admin, key.guestId);
  if (!target || target.event_id !== key.eventId) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });
  const kit = await loadPassCardKit(admin, key.eventId, { seatsFor: [key.guestId] });
  if (!kit?.set.event.slug) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  const couple = (kit.set.event.display_name ?? '').trim() || 'the couple';
  try {
    const png = await renderPassCardFor(kit, target, 'classic', { pending: REQUEST_WORDS.bandSub(couple) });
    return new NextResponse(Buffer.from(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${passCardFileNameFor(kit, target)}"`,
        // Private and never reused: the same address draws "pending" today and
        // 404s the moment the couple decides.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    logQueryError('request-ticket.render', err, { guest_id: key.guestId }, 'graceful_degrade');
    return new NextResponse(`Could not draw your ${PASS_CARD_WORDS.noun} just now. Try again.`, { status: 503 });
  }
}
