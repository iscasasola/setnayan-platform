'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { readGuestSession, setGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Guest QR self-rotation (build ④ · owner-signed 2026-07-23: rotation
 * authority includes GUESTS, self-service). Zero-account: the actor is
 * authenticated purely by their signed setnayan_guest_session cookie — the
 * server validates it, then calls the SECURITY DEFINER RPC with the admin
 * client (actor_kind='guest_self'; the RPC accepts guest_self ONLY from
 * service_role, and anon has no EXECUTE grant — mirrors the
 * papic_complete_mission cookie-validating precedent).
 *
 * FLAG: GUEST_QR_SELF_ROTATE (default OFF) — while off this action is inert
 * and the hub button never renders.
 *
 * POSSESSION CHECK (always on, independent of GUEST_SESSION_TOKEN_CHECK):
 * the session's embedded qr_token must equal the guest row's CURRENT
 * qr_token. A stale session minted from an already-rotated (possibly leaked)
 * token can therefore never rotate again — only the current QR holder can.
 *
 * Rate limits: durable 3/guest/24h lives INSIDE the RPC (the real ceiling);
 * the in-memory per-IP + per-guest gates here are a cheap same-instance
 * backstop (lib/rate-limit.ts is per-instance by design).
 */

export type SelfRotateResult =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'not_signed_in' | 'rate_limited' | 'error' };

type RotateRpcResult = {
  ok: boolean;
  reason?: string;
  qr_token?: string;
  rotated_at?: string;
};

export async function rotateMyGuestQr(slug: string): Promise<SelfRotateResult> {
  if (process.env.GUEST_QR_SELF_ROTATE !== 'true') {
    return { ok: false, reason: 'disabled' };
  }

  const session = await readGuestSession();
  if (!session) return { ok: false, reason: 'not_signed_in' };

  // In-memory backstops (per warm instance) — the durable limit is in the RPC.
  const hdrs = await headers();
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  const ipGate = rateLimit(`guest-qr-rotate:ip:${ip}`, 10, 60 * 60 * 1000);
  const guestGate = rateLimit(
    `guest-qr-rotate:guest:${session.guest_id}`,
    3,
    24 * 60 * 60 * 1000,
  );
  if (!ipGate.ok || !guestGate.ok) return { ok: false, reason: 'rate_limited' };

  const admin = createAdminClient();

  // Possession check — only a session minted from the CURRENT token may rotate.
  const { data: guest, error: guestErr } = await admin
    .from('guests')
    .select('guest_id, event_id, qr_token, display_name, first_name')
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestErr) return { ok: false, reason: 'error' };
  if (!guest || guest.event_id !== session.event_id || guest.qr_token !== session.qr_token) {
    return { ok: false, reason: 'not_signed_in' };
  }

  const { data: rpcData, error: rpcError } = await admin.rpc('rotate_guest_qr_token', {
    p_guest_id: session.guest_id,
    p_actor_kind: 'guest_self',
  });
  if (rpcError) return { ok: false, reason: 'error' };
  const res = rpcData as RotateRpcResult | null;
  if (!res?.ok || typeof res.qr_token !== 'string') {
    return {
      ok: false,
      reason: res?.reason === 'rate_limited' ? 'rate_limited' : 'error',
    };
  }

  // Re-sign the actor's OWN cookie with the new token so the rotating guest is
  // not logged out — every OTHER session holding the old token dies once
  // GUEST_SESSION_TOKEN_CHECK is on (and every old QR/link dies immediately).
  await setGuestSession({
    guest_id: guest.guest_id,
    event_id: guest.event_id,
    qr_token: res.qr_token,
  });

  // Best-effort security_alert to all hosts — fire-and-forget after the
  // response; emitNotification never throws (account-security precedent).
  const guestName = guest.display_name || guest.first_name || 'A guest';
  const eventId = guest.event_id;
  after(async () => {
    try {
      const { data: hosts } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      await Promise.all(
        (hosts ?? []).map((h) =>
          emitNotification({
            userId: h.user_id,
            type: 'security_alert',
            title: 'A guest replaced their QR code',
            body:
              `${guestName} issued themselves a new personal QR from their invitation page. ` +
              'Their old printed QR and previously shared links no longer work; their RSVP, ' +
              'seat, and photos are unchanged. If this seems wrong, you can replace their QR ' +
              'again from Invitations.',
            relatedUrl: `/dashboard/${eventId}/invitation`,
          }),
        ),
      );
    } catch {
      // best-effort — never surfaces to the guest
    }
  });

  // Refresh the invitation page so the new QR renders immediately. The slug is
  // path-shaped only (route param) — sanitize before interpolating.
  const safeSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
  if (safeSlug) revalidatePath(`/${safeSlug}`);

  return { ok: true };
}
