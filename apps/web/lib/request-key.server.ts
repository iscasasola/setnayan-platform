import 'server-only';

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requestKeyState, type RequestKeyState } from '@/lib/request-key';

/**
 * THE REMEMBERED REQUEST — this browser's own key for a request it sent (owner
 * 2026-09-29, DECISION_LOG "A GUEST ACCEPTED FROM THE GENERIC LINK LANDS ON THEIR
 * OWN INVITATION": *"on Send, the pending guest's browser is remembered … still
 * gated"*). Decisions live in `lib/request-key.ts`; this file only reads.
 *
 * 🔒 IT IS NOT A GUEST SESSION, ON PURPOSE. The guest session
 * (`setnayan_guest_session`) opens every guest page, and it checks only that the
 * row exists — a pending request row would pass. So a request's key lives in its
 * OWN cookie that no guest page reads; only the request screen, the pending
 * ticket and the redeem hop do, and each asks `requestKeyState` live.
 *
 * The cookie holds the row's `qr_token` — the same credential its QR carries —
 * httpOnly, so the page's script cannot read it; nothing else is stored.
 */
export const REQUEST_KEY_COOKIE = 'sn_request_key';
const MAX_AGE = 60 * 60 * 24 * 60;
const HEX32 = /^[0-9a-f]{32}$/;

export async function rememberRequestKey(qrToken: string): Promise<void> {
  if (!HEX32.test(qrToken)) return;
  const jar = await cookies();
  jar.set(REQUEST_KEY_COOKIE, qrToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function forgetRequestKey(): Promise<void> {
  const jar = await cookies();
  jar.delete(REQUEST_KEY_COOKIE);
}

export type RequestKeyRead = {
  guestId: string;
  eventId: string;
  qrToken: string;
  name: string;
  state: RequestKeyState;
};

/** A key's row and what it opens now — removed rows included (Decline / Link). */
export async function readRequestKeyByToken(qrToken: string | null | undefined): Promise<RequestKeyRead | null> {
  const token = (qrToken ?? '').trim().toLowerCase();
  if (!HEX32.test(token)) return null;
  const { data, error } = await createAdminClient()
    .from('guests')
    .select('guest_id, event_id, qr_token, first_name, last_name, display_name, entry_source, deleted_at, custom_tags')
    .eq('qr_token', token)
    .maybeSingle();
  if (error) {
    logQueryError('request-key.read', error, {}, 'graceful_degrade');
    return null;
  }
  if (!data) return null;
  const name =
    ((data.display_name as string | null) ?? '').trim() ||
    `${(data.first_name as string | null) ?? ''} ${((data.last_name as string | null) ?? '').replace(/^—$/, '')}`.trim() ||
    'Guest';
  return {
    guestId: data.guest_id as string,
    eventId: data.event_id as string,
    qrToken: data.qr_token as string,
    name,
    state: requestKeyState({
      entry_source: data.entry_source as string | null,
      deleted_at: data.deleted_at as string | null,
      custom_tags: data.custom_tags as string[] | null,
    }),
  };
}

/** This browser's remembered request for THIS event, or null. */
export async function readRememberedRequest(eventId: string): Promise<RequestKeyRead | null> {
  const jar = await cookies();
  const read = await readRequestKeyByToken(jar.get(REQUEST_KEY_COOKIE)?.value);
  return read && read.eventId === eventId ? read : null;
}
