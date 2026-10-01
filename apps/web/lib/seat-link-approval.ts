import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { resolveGuestSessionSecret } from '@/lib/guest-session';

/**
 * seat-link-approval.ts — "THE COUPLE SENT THIS LINK", as something a URL
 * cannot forge.
 *
 * A couple seat (bride · groom · celebrant) is never bound by a guest link
 * (`lib/seat-binding.ts`). But the couple's PARTNER is often not the account
 * that created the event, and "co-hosts come from the guest list" (owner
 * 2026-09-28) needs their account bound to their own row before the Co-host
 * seat can go live. The one door the couple chooses for that is the guest
 * card's "send them a sign-in link" (`inviteGuestByEmailAction`). That link
 * carries this token in its `/join/{id}/connect` return, signed with the guest
 * pass's own secret, naming the event, the row and the address it was sent to.
 *
 * The connect step honours it ONLY for that row, that event, and an account
 * signed in with that same address — a forwarded link opened by somebody else's
 * account is refused like any other guest link. Expires with the day.
 */

const PURPOSE = 'couple_sent_seat_link';
const LIFETIME = '24h';

function secret(): Uint8Array | null {
  const r = resolveGuestSessionSecret();
  return r.ok ? new TextEncoder().encode(r.material) : null;
}

export async function signCoupleSeatLink(input: {
  eventId: string;
  guestId: string;
  email: string;
}): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  return await new SignJWT({
    purpose: PURPOSE,
    event_id: input.eventId,
    guest_id: input.guestId,
    email: input.email.trim().toLowerCase(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LIFETIME)
    .sign(key);
}

/** True only for a valid, unexpired token naming exactly this event, row and address. */
export async function coupleSentThisSeatLink(
  token: string | null | undefined,
  expect: { eventId: string; guestId: string; email: string | null },
): Promise<boolean> {
  if (!token || !expect.email) return false;
  const key = secret();
  if (!key) return false;
  try {
    const { payload } = await jwtVerify(token, key);
    return (
      payload.purpose === PURPOSE &&
      payload.event_id === expect.eventId &&
      payload.guest_id === expect.guestId &&
      payload.email === expect.email.trim().toLowerCase()
    );
  } catch {
    return false;
  }
}
