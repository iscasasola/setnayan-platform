import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { REENTRY_TTL_SECONDS, isUrlSecretShaped, type ReentryPurpose } from '@/lib/guest-pass-hop';

/**
 * lib/guest-reentry.ts — THE SHORT-LIVED, SINGLE-USE GUEST RE-ENTRY CODE.
 *
 * Carries a guest's pass across to ANOTHER cookie jar exactly once: a chat
 * app's own "Open in Safari" (the landing's `?k=`), or the iPhone home-screen
 * tile, which keeps its own cookies (the tile's start address `?k=`). The table,
 * its RLS and the why: supabase/migrations/20271263854263_a_guest_re_entry_code_is_single_use.sql.
 *
 * 🔒 THE RULES, each held by lib/guest-reentry.test.ts:
 *   · server-issued: 32 random bytes, base64url — never derived from the pass
 *     token (`guests.qr_token`) and never containing it;
 *   · stored ONLY as sha256 hex — the raw code exists in the URL and nowhere else;
 *   · exchanged ONCE: one conditional UPDATE (unused AND unexpired → used_at),
 *     so two racing opens cannot both win;
 *   · guest-scoped: it answers with the guest it was minted for, for the event
 *     it was minted on, and the caller writes that guest's NORMAL pass — never
 *     an account session.
 *
 * Every failure is an answer, never a throw: a code that cannot be minted is
 * simply not added to the URL (today's behaviour), and one that cannot be
 * exchanged sends the guest where they would have gone without it.
 */

export function hashReentryCode(code: string): string {
  return createHash('sha256').update(`setnayan-guest-reentry:${code}`).digest('hex');
}

export function newReentryCode(): string {
  return randomBytes(32).toString('base64url');
}

/** A SERVICE-ROLE client (the table has no browser grant). Passed in, so the
 *  test drives the real logic without a database; lib/guest-reentry.server.ts
 *  hands in the admin client. `null` = no client could be built. */
export type ReentryDb = SupabaseClient<any, any, any>;

/**
 * Mint one code for this guest. Returns the RAW code (for the URL) or null.
 * Clears the guest's already-dead codes on the way, so the table holds only
 * what can still be used (plus used codes until they expire).
 */
export async function mintReentryCode(
  input: { eventId: string; guestId: string; purpose: ReentryPurpose; now?: Date },
  db: ReentryDb | null,
): Promise<string | null> {
  const admin = db;
  if (!admin) return null;
  const now = input.now ?? new Date();
  const code = newReentryCode();
  try {
    // Housekeeping: a failed clear-out only leaves dead rows (each still
    // refused by its own expiry), so it is logged and the mint goes on.
    const { error: clearError } = await admin
      .from('guest_reentry_codes')
      .delete()
      .eq('guest_id', input.guestId)
      .lt('expires_at', now.toISOString());
    if (clearError) console.error('[supabase-error] lib/guest-reentry.ts · from:guest_reentry_codes.delete', clearError);
    const { error } = await admin.from('guest_reentry_codes').insert({
      code_hash: hashReentryCode(code),
      event_id: input.eventId,
      guest_id: input.guestId,
      purpose: input.purpose,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + REENTRY_TTL_SECONDS[input.purpose] * 1000).toISOString(),
    });
    if (error) {
      console.error('[supabase-error] lib/guest-reentry.server.ts · from:guest_reentry_codes.insert', error);
      return null;
    }
    return code;
  } catch (err) {
    console.error('[guest-reentry] mint threw', err);
    return null;
  }
}

/** Whose code this is (for this event), or null — read only, spends nothing. */
export async function reentryCodeGuest(
  input: { code: string | null | undefined; eventId: string },
  db: ReentryDb | null,
): Promise<string | null> {
  if (!isUrlSecretShaped(input.code)) return null;
  const admin = db;
  if (!admin) return null;
  try {
    const { data } = await admin
      .from('guest_reentry_codes')
      .select('guest_id')
      .eq('code_hash', hashReentryCode(input.code))
      .eq('event_id', input.eventId)
      .maybeSingle();
    return (data?.guest_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export type ReentryExchange =
  | { ok: true; guestId: string; eventId: string; qrToken: string; purpose: ReentryPurpose }
  | { ok: false; reason: 'malformed' | 'unknown' | 'used' | 'expired' | 'wrong-event' | 'guest-gone' | 'unreachable'; guestId?: string };

/**
 * Spend a code: the ONE conditional UPDATE marks it used only if it is unused,
 * unexpired and minted for THIS event. Nothing else is written here — the caller
 * (the redeem route) writes the guest's normal pass.
 */
export async function exchangeReentryCode(
  input: { code: string | null | undefined; eventId: string; now?: Date },
  db: ReentryDb | null,
): Promise<ReentryExchange> {
  if (!isUrlSecretShaped(input.code)) return { ok: false, reason: 'malformed' };
  const admin = db;
  if (!admin) return { ok: false, reason: 'unreachable' };
  const now = (input.now ?? new Date()).toISOString();
  const hash = hashReentryCode(input.code);
  try {
    const { data: spent, error } = await admin
      .from('guest_reentry_codes')
      .update({ used_at: now })
      .eq('code_hash', hash)
      .eq('event_id', input.eventId)
      .is('used_at', null)
      .gt('expires_at', now)
      .select('guest_id, event_id, purpose')
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/guest-reentry.server.ts · from:guest_reentry_codes.update', error);
      return { ok: false, reason: 'unreachable' };
    }
    if (!spent) {
      // Why not — read only to NAME the refusal for the Problems log.
      const { data: row } = await admin
        .from('guest_reentry_codes')
        .select('guest_id, event_id, used_at, expires_at')
        .eq('code_hash', hash)
        .maybeSingle();
      if (!row) return { ok: false, reason: 'unknown' };
      const guestId = row.guest_id as string;
      if (row.event_id !== input.eventId) return { ok: false, reason: 'wrong-event' };
      if (row.used_at) return { ok: false, reason: 'used', guestId };
      return { ok: false, reason: 'expired', guestId };
    }
    const { data: guest } = await admin
      .from('guests')
      .select('guest_id, event_id, qr_token')
      .eq('guest_id', spent.guest_id as string)
      .eq('event_id', input.eventId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!guest?.qr_token) return { ok: false, reason: 'guest-gone' };
    return {
      ok: true,
      guestId: guest.guest_id as string,
      eventId: guest.event_id as string,
      qrToken: guest.qr_token as string,
      purpose: spent.purpose as ReentryPurpose,
    };
  } catch (err) {
    console.error('[guest-reentry] exchange threw', err);
    return { ok: false, reason: 'unreachable' };
  }
}
